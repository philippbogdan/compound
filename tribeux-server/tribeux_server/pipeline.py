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
from typing import Any

from . import claude_analyst, frames, inference, jobs
from .cohort import load_cohort
from .schemas import (
    AppliedPatch,
    Frame,
    InferenceResult,
    PatchProposal,
    Report,
)


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


async def run_pipeline(job_id: str, url: str, *, use_real_render: bool) -> None:
    log = lambda stage, msg: jobs.store.log(job_id, stage, msg)
    prog = lambda stage, pct: jobs.store.progress(job_id, stage, pct)

    # Pacing: when running offline (sample mode) the pipeline finishes in
    # <50 ms which would skip the Demo page entirely. We deliberately
    # space stages out so the UI gets a chance to narrate the work.
    pace_s = 0.0 if use_real_render else 1.4

    async def beat(seconds: float = pace_s) -> None:
        if seconds > 0:
            await asyncio.sleep(seconds)

    try:
        prog("render", 0.05)
        log("render", f"playwright.chromium.headless · target {url}")
        units, full_screenshot_v1 = await _run_domtree(url) if use_real_render else (_fallback_units(), None)
        log("render", f"tribedomtree extracted {len(units)} DOM unit(s)")
        await beat()

        prog("encode", 0.18)
        log("encode", "scroll capture · 13 timesteps · 256² downsample")
        v1_frames, full_v1 = await frames.capture_frames(
            url, n_timesteps=13, use_real_render=use_real_render
        )
        full_screenshot_v1 = full_v1 or full_screenshot_v1
        log("encode", f"captured {len(v1_frames)} frame(s)")
        await beat()

        prog("tribe", 0.35)
        log("tribe", "tribev2.stub · forwarding 13 frames")
        v1 = inference.run_tribe_inference(url, v1_frames, label=url)
        log("tribe", "v1 headline cohort_z = " + _fmt_cohort(v1))
        await beat()

        prog("project", 0.5)
        log("project", "destrieux mapping · attention/self/reward/disgust")
        await beat()

        prog("benchmark", 0.6)
        cohort = load_cohort()
        log("benchmark", f"cohort n={cohort.n} · axes={','.join(cohort.axes)}")
        await beat()

        prog("claude", 0.72)
        log(
            "claude",
            "anthropic.messages.create · sending time-series + per-second frames + units",
        )
        findings = claude_analyst.analyze(
            inference=v1, frames=v1_frames, cohort=cohort, units=units
        )
        log(
            "claude",
            f"{findings.model}{' (mock)' if findings.mock else ''} · "
            f"{len(findings.anomalies)} anomaly · {len(findings.patches)} patch",
        )
        for a in findings.anomalies:
            log("claude", f"anomaly[{a.axis}] t={a.t_start}-{a.t_end} σ={a.severity:.2f}")
        await beat()

        prog("frames", 0.82)
        log("frames", f"asked frames: {findings.asked_for_frame_indices}")
        await beat()

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
        )
        jobs.store.finish(job_id, report)
        log("done", f"overall predicted uplift {signed:+.2f}σ")
    except Exception as exc:  # noqa: BLE001
        jobs.store.fail(job_id, repr(exc))
        log("error", repr(exc))


def _fmt_cohort(r: InferenceResult) -> str:
    cohort = r.video_modality.headline_scores_vs_cohort
    return (
        f"att {cohort.attention.cohort_z:+.2f} · self {cohort.self_relevance.cohort_z:+.2f} "
        f"· reward {cohort.reward.cohort_z:+.2f} · disgust {cohort.disgust.cohort_z:+.2f}"
    )
