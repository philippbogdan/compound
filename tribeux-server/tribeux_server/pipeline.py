"""Pipeline orchestrator.

Runs a single analysis: render → frames → stub TRIBE → Claude analyst →
tribedomtree-driven patching → re-frame → stub TRIBE re-inference →
assemble report.

Every stage emits log lines + progress so the Demo page streams real
status. Failures in optional stages (live render, real Claude, real
patching) degrade gracefully to deterministic fallbacks so the demo
never breaks.
"""
from __future__ import annotations

import asyncio
import base64
import dataclasses
import os
from typing import Any

from . import claude_analyst, frames, inference, jobs, render, cache
from .cohort import load_cohort
from .schemas import (
    AppliedPatch,
    Frame,
    InferenceResult,
    PatchProposal,
    Report,
)
from .timeline import build_patch_script, build_timeline, resolve_history


# ---------------------------------------------------------------------------
# tribedomtree integration
# ---------------------------------------------------------------------------


async def _run_domtree(url: str) -> tuple[list[dict[str, Any]], bytes | None]:
    """Render via tribedomtree and return serialised units + screenshot.

    Falls back gracefully when the URL is unreachable so the demo never
    blocks on flaky external sites — Claude still gets a usable list of
    DOM units (the units from `samples/site_1` style fallback).
    """
    try:
        from tribeux_domtree import analyze  # type: ignore

        result = await analyze(url)
    except Exception:  # noqa: BLE001
        return _fallback_units(), None

    units = []
    for u in result.units[:60]:  # cap to keep prompt sizes sane
        units.append(
            {
                "id": u.id,
                "section": u.section,
                "tag": u.tag,
                "selector": u.selector,
                "xpath": u.xpath,
                "text": (u.text or "")[:280],
                "outer_html": (u.outer_html or "")[:1200],
                "importance": u.importance,
                "computed_style": getattr(u, "computed_style", {}) or {},
                "bbox": dataclasses.asdict(u.bbox) if hasattr(u.bbox, "__dataclass_fields__") else u.bbox.__dict__,
            }
        )
    return units, result.screenshot_png


def _fallback_units() -> list[dict[str, Any]]:
    return [
        {
            "id": "hero.heading_1",
            "section": "hero",
            "tag": "H1",
            "selector": "h1",
            "xpath": "/html/body/main/h1",
            "text": "Belong anywhere.",
            "outer_html": "<h1 class=\"hero__title\">Belong anywhere.</h1>",
            "importance": {"combined": 0.93, "visual": 0.88, "semantic": 0.95},
            "bbox": {"x": 80, "y": 220, "w": 720, "h": 96},
        },
        {
            "id": "hero.cta_1",
            "section": "hero",
            "tag": "BUTTON",
            "selector": "button.hero__cta",
            "xpath": "/html/body/main/button[1]",
            "text": "Find your next stay!",
            "outer_html": "<button class=\"hero__cta\">Find your next stay!</button>",
            "importance": {"combined": 0.91, "visual": 0.84, "semantic": 0.92},
            "bbox": {"x": 80, "y": 380, "w": 220, "h": 56},
        },
        {
            "id": "features.heading_1",
            "section": "features",
            "tag": "H2",
            "selector": ".features h2",
            "xpath": "/html/body/section[2]/h2",
            "text": "What hosts make available",
            "outer_html": "<h2>What hosts make available</h2>",
            "importance": {"combined": 0.71, "visual": 0.62, "semantic": 0.78},
            "bbox": {"x": 80, "y": 880, "w": 600, "h": 56},
        },
    ]


async def _apply_patch_live(
    url: str, proposal: PatchProposal
) -> tuple[bool, str | None, bytes | None]:
    try:
        from tribeux_domtree.patch import apply_patch  # type: ignore

        png = await apply_patch(url, proposal.selector, proposal.after_html)
        return True, None, png
    except Exception as exc:  # noqa: BLE001
        return False, str(exc), None


def _png_to_data_url(png: bytes | None) -> str | None:
    if not png:
        return None
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


STAGE_LABELS = {
    "render":    "PLAYWRIGHT.CHROMIUM · TRIBEDOMTREE EXTRACT",
    "encode":    "SCROLL CAPTURE · 13 × 256²",
    "tribe":     "TRIBE v2 · CORTICAL FORWARD",
    "project":   "DESTRIEUX · 4 AFFECTIVE AXES",
    "benchmark": "COHORT · n=30 LANDING PAGES",
    "claude":    "ANTHROPIC · ANOMALY + REDESIGN",
    "frames":    "FRAME PULL · CLAUDE-FLAGGED INDICES",
    "compose":   "TRIBEDOMTREE PATCH · v2 INFERENCE",
    "done":      "VERDICT · PREDICTED UPLIFT",
}


async def run_pipeline(
    job_id: str,
    url: str,
    *,
    use_real_render: bool,
    parent_job_id: str | None = None,
    iteration_index: int = 0,
) -> None:
    log = lambda stage, msg: jobs.store.log(job_id, stage, msg)
    prog = lambda stage, pct: jobs.store.progress(job_id, stage, pct)

    # Pacing: when running offline (sample mode) the pipeline finishes in
    # <50 ms which would skip the Demo page entirely. We deliberately
    # space stages out so the UI gets a chance to narrate the work.
    pace_s = 0.0 if use_real_render else 1.4

    async def beat(seconds: float = pace_s) -> None:
        if seconds > 0:
            await asyncio.sleep(seconds)

    def stage(name: str):
        return jobs.stage(job_id, name, STAGE_LABELS.get(name, name.upper()))

    # Resolve the prior-iteration chain up-front so downstream stages can
    # see what's already been applied.
    prior_history, past_edit_unit_ids, _ = resolve_history(jobs.store, parent_job_id)
    patch_script = build_patch_script(prior_history)
    if parent_job_id:
        log(
            "render",
            f"iteration {iteration_index} · parent={parent_job_id} · "
            f"{len(prior_history)} prior edit(s) being replayed",
        )

    # DEMO CACHE: if TRIBEUX_CACHE=1 and there's a hit for (url, patch_script),
    # fast-replay the cached job so the UI still narrates stages but each pass
    # completes in ~3-5 s instead of a full Colab round-trip.
    cache_key = cache.key_for(url, patch_script or "")
    if cache.enabled() and not cache.bypass():
        hit = cache.get(cache_key)
        if hit is not None:
            await _replay_cached(job_id, url, parent_job_id, iteration_index, hit)
            return

    # Live pipeline — collect SSE events into parallel lists so we can cache them.
    cached_logs: list[dict] = []
    cached_checkpoints: list[dict] = []
    cached_progress: list[dict] = []

    _orig_log = log
    _orig_prog = prog

    def log(stage: str, msg: str) -> None:  # noqa: F811 — intentional shadow
        cached_logs.append({"stage": stage, "message": msg})
        _orig_log(stage, msg)

    def prog(stage: str, pct: float) -> None:  # noqa: F811 — intentional shadow
        cached_progress.append({"stage": stage, "pct": pct})
        _orig_prog(stage, pct)

    # Tap checkpoint events via the jobs.stage context manager's side effects
    # by inspecting job state after each stage end; simpler: snapshot at finish.

    try:
        async with stage("render"):
            prog("render", 0.05)
            log("render", f"playwright.chromium.headless · target {url}")
            units, full_screenshot_v1 = await _run_domtree(url) if use_real_render else (_fallback_units(), None)
            log("render", f"tribedomtree extracted {len(units)} DOM unit(s)")
            await beat()

        video_path: str | None = None
        page_text = ""
        scroll_log: list = []
        total_height = 0
        viewport_h = 1024
        actual_duration_s = 0.0
        async with stage("encode"):
            prog("encode", 0.18)
            if use_real_render:
                log("encode", "url_to_video · 15s scroll · 256² @ 30fps")
                rendered = await render.render_url(
                    url,
                    duration=15,
                    patch_script=patch_script or None,
                )
                video_path = rendered["video_path"]
                page_text = rendered["page_text"]
                v1_frames = rendered["frames"]
                full_screenshot_v1 = rendered["full_page_png"] or full_screenshot_v1
                scroll_log = rendered.get("scroll_log") or []
                total_height = rendered.get("total_height", 0)
                viewport_h = rendered.get("viewport_h", 1024)
                actual_duration_s = rendered.get("actual_duration_s", 15.0)
                log(
                    "encode",
                    f"video {video_path} · {len(page_text)} chars text · "
                    f"{len(v1_frames)} frame(s) · scroll_log n={len(scroll_log)} · "
                    f"duration {actual_duration_s:.2f}s",
                )
                # Make the scrolling capture visible to the Demo page as
                # soon as it exists — later stages (tribe / claude /
                # compose) keep running, but the user sees the actual
                # scraped video instead of a single stimulus PNG.
                jobs.store.set_video(job_id, video_path)
            else:
                log("encode", "scroll capture · 13 timesteps · 256² downsample (sample mode)")
                v1_frames, full_v1 = await frames.capture_frames(
                    url, n_timesteps=13, use_real_render=False
                )
                full_screenshot_v1 = full_v1 or full_screenshot_v1
                log("encode", f"captured {len(v1_frames)} frame(s)")
            await beat()

        async with stage("tribe"):
            prog("tribe", 0.35)
            mode = "live" if os.environ.get("TRIBE_INFERENCE_URL") and os.environ.get("MOCK_TRIBE", "0") not in ("1", "true", "True") else "stub"
            log("tribe", f"tribev2.{mode} · POST /score · {len(v1_frames)} frames" + (f" · video={video_path}" if video_path else ""))
            v1 = await inference.run_tribe_inference(url, v1_frames, label=url, video_path=video_path)
            log("tribe", "v1 headline cohort_z = " + _fmt_cohort(v1))
            await beat()

        async with stage("project"):
            prog("project", 0.5)
            log("project", "destrieux mapping · attention/self/reward/disgust")
            await beat()

        async with stage("benchmark"):
            prog("benchmark", 0.6)
            cohort = load_cohort()
            log("benchmark", f"cohort n={cohort.n} · axes={','.join(cohort.axes)}")
            await beat()

        # Build the per-second timeline + finalize history with the score we just measured.
        cohort_now = {
            "attention":      v1.video_modality.headline_scores_vs_cohort.attention.cohort_z,
            "self_relevance": v1.video_modality.headline_scores_vs_cohort.self_relevance.cohort_z,
            "reward":         v1.video_modality.headline_scores_vs_cohort.reward.cohort_z,
            "disgust":        v1.video_modality.headline_scores_vs_cohort.disgust.cohort_z,
        }
        timeline_block = build_timeline(
            units, scroll_log, v1,
            viewport_h=viewport_h,
            total_height=total_height,
            actual_duration_s=actual_duration_s,
        )
        full_history, past_edit_ids, _ = resolve_history(
            jobs.store, parent_job_id, current_cohort=cohort_now,
        )

        async with stage("claude"):
            prog("claude", 0.72)
            log(
                "claude",
                "anthropic.messages.create · sending time-series + per-second frames + units + timeline + history",
            )
            findings = claude_analyst.analyze(
                inference=v1,
                frames=v1_frames,
                cohort=cohort,
                units=units,
                timeline=timeline_block,
                history=full_history,
                iteration_index=iteration_index,
                past_edit_unit_ids=past_edit_ids,
            )
            log(
                "claude",
                f"{findings.model}{' (mock)' if findings.mock else ''} · "
                f"{len(findings.anomalies)} anomaly · {len(findings.patches)} patch · "
                f"done={findings.done}",
            )
            for a in findings.anomalies:
                log("claude", f"anomaly[{a.axis}] t={a.t_start}-{a.t_end} σ={a.severity:.2f}")
            if findings.history_note:
                log("claude", f"history_note: {findings.history_note}")
            await beat()

        async with stage("frames"):
            prog("frames", 0.82)
            log("frames", f"asked frames: {findings.asked_for_frame_indices}")
            await beat()

        async with stage("compose"):
            prog("compose", 0.9)
            applied: list[AppliedPatch] = []
            full_v2: bytes | None = None
            for p in findings.patches:
                if use_real_render:
                    ok, err, png = await _apply_patch_live(url, p)
                    full_v2 = png or full_v2
                    applied.append(AppliedPatch(proposal=p, applied=ok, error=err))
                    log(
                        "compose",
                        f"patch {p.unit_id} · {p.target_axis} · "
                        + ("applied" if ok else f"skipped ({err})"),
                    )
                else:
                    applied.append(AppliedPatch(proposal=p, applied=False, error="sample-mode"))
                    log("compose", f"patch {p.unit_id} · {p.target_axis} · queued (sample-mode)")

            # v2 inference: shift cohort_z + time-series by Claude's predicted uplift
            uplift_per_axis: dict[str, float] = {"attention": 0.0, "self_relevance": 0.0, "reward": 0.0, "disgust": 0.0}
            for p in findings.patches:
                uplift_per_axis[p.target_axis] += p.expected_delta_z
            v2 = inference.run_v2_inference(url, v1_frames, v1, uplift_per_axis)
            log("compose", "v2 headline cohort_z = " + _fmt_cohort(v2))
            await beat()

        # Direction-aware overall uplift: positive on attention/self/reward, negative on disgust
        signed = sum(
            -u if axis == "disgust" else u for axis, u in uplift_per_axis.items()
        )

        report = Report(
            url=url,
            v1=v1,
            v2=v2,
            cohort=cohort,
            frames=v1_frames,
            findings=findings,
            applied_patches=applied,
            screenshot_v1_data_url=_png_to_data_url(full_screenshot_v1),
            screenshot_v2_data_url=_png_to_data_url(full_v2),
            predicted_uplift_per_axis=uplift_per_axis,
            overall_predicted_uplift=signed,
            iteration_index=iteration_index,
            parent_job_id=parent_job_id,
            timeline=timeline_block,
            history=full_history,
            done=findings.done,
        )
        log("done", f"overall predicted uplift {signed:+.2f}σ · done={findings.done}")
        jobs.store.checkpoint(
            job_id, "done", "end", STAGE_LABELS["done"], elapsed_ms=0
        )
        jobs.store.finish(job_id, report)

        # Cache the completed job for future demo re-runs.
        if cache.enabled():
            current_job = jobs.store.get(job_id)
            cps = [cp.model_dump() for cp in (current_job.checkpoints if current_job else [])]
            cache.put(
                cache_key,
                report=report,
                logs=cached_logs,
                checkpoints=cps,
                progress_trace=cached_progress,
            )
    except Exception as exc:  # noqa: BLE001
        # Emit the human-readable log line BEFORE marking the job failed.
        # `fail()` broadcasts a terminal `done` event that causes SSE
        # subscribers to disconnect — anything broadcast after `done` is
        # lost for live viewers (still saved to job.logs for replay, but
        # never seen in real time).
        log("error", repr(exc))
        jobs.store.fail(job_id, repr(exc))


def _fmt_cohort(r: InferenceResult) -> str:
    cohort = r.video_modality.headline_scores_vs_cohort
    return (
        f"att {cohort.attention.cohort_z:+.2f} · self {cohort.self_relevance.cohort_z:+.2f} "
        f"· reward {cohort.reward.cohort_z:+.2f} · disgust {cohort.disgust.cohort_z:+.2f}"
    )


_CACHE_STAGE_BEAT_S = float(os.environ.get("TRIBEUX_CACHE_STAGE_BEAT_S", "0.35"))


async def _replay_cached(
    job_id: str,
    url: str,
    parent_job_id: str | None,
    iteration_index: int,
    hit: dict,
) -> None:
    """Replay a cached job's SSE stream at demo pace (~3-5 s total).

    We issue the same progress + log events the live pipeline emitted so
    the Demo page still animates through all stages; just faster.
    """
    report_dict = hit.get("report") or {}
    cached_logs = hit.get("logs") or []
    cached_progress = hit.get("progress_trace") or []

    jobs.store.log(job_id, "render", "CACHE HIT · replaying from disk")

    # Reproduce progress events in order with a short beat between stages.
    emitted_stages: set[str] = set()
    for entry in cached_progress:
        stage = entry.get("stage", "")
        pct = float(entry.get("pct", 0.0))
        jobs.store.progress(job_id, stage, pct)
        if stage not in emitted_stages:
            emitted_stages.add(stage)
            label = STAGE_LABELS.get(stage, stage.upper()) + " · CACHED"
            jobs.store.checkpoint(job_id, stage, "begin", label, elapsed_ms=0)
        # Dribble the stage's logs as we hit its progress marker.
        for lg in cached_logs:
            if lg.get("stage") == stage and lg.get("message"):
                jobs.store.log(job_id, stage, lg["message"])
        await asyncio.sleep(_CACHE_STAGE_BEAT_S)
        jobs.store.checkpoint(job_id, stage, "end",
                              STAGE_LABELS.get(stage, stage.upper()) + " · CACHED",
                              elapsed_ms=int(_CACHE_STAGE_BEAT_S * 1000))

    # Rehydrate Report with the current iteration context (parent / iter_index
    # from THIS call, not the cached one — patch chain-awareness).
    report_dict["url"] = url
    report_dict["parent_job_id"] = parent_job_id
    report_dict["iteration_index"] = iteration_index
    try:
        report = Report.model_validate(report_dict)
    except Exception as exc:  # noqa: BLE001 — fall through to fail if corrupt
        jobs.store.fail(job_id, f"cache replay decode failed: {exc!r}")
        return

    jobs.store.log(job_id, "done", "cached replay complete")
    jobs.store.checkpoint(job_id, "done", "end", STAGE_LABELS["done"] + " · CACHED",
                          elapsed_ms=0)
    jobs.store.finish(job_id, report)
