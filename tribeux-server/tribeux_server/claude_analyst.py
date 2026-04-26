"""Claude analyst — iteration-aware UX optimizer.

Given per-second scores + DOM timeline + prior-iteration history, Claude
returns up to two minimal edits calibrated to the worst axis's severity.
The orchestrator replays those edits via `patch_script` on the next
recording so the brain re-scores the visibly-patched page.

Falls back to a deterministic mock when `MOCK_CLAUDE=1` or no API key.
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional

from .schemas import (
    Anomaly,
    Axis,
    ClaudeFindings,
    Cohort,
    Frame,
    HistoryEntry,
    InferenceResult,
    PatchProposal,
    TimelineBlock,
)

_AXES: tuple[Axis, ...] = ("attention", "self_relevance", "reward", "disgust")
_CONVERGE_ABS_Z = 0.5


def _parse_json_object(text: str) -> dict:
    """Parse the first JSON object from Claude's reply, tolerant to prose / fences."""
    s = text.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s[3:]
        if s.endswith("```"):
            s = s[:-3]
        s = s.strip()
        if s.lower().startswith("json"):
            s = s[4:].strip()
    if not s.startswith("{"):
        i, j = s.find("{"), s.rfind("}")
        if i == -1 or j == -1 or j <= i:
            raise ValueError(f"no JSON object in response: {text[:200]!r}")
        s = s[i : j + 1]
    return json.loads(s)


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------


def analyze(
    *,
    inference: InferenceResult,
    frames: list[Frame],
    cohort: Cohort,
    units: list[dict[str, Any]],
    timeline: Optional[TimelineBlock] = None,
    history: Optional[list[HistoryEntry]] = None,
    iteration_index: int = 0,
    past_edit_unit_ids: Optional[list[str]] = None,
) -> ClaudeFindings:
    """Run the analyst. Falls back to a deterministic mock when keys/env say so."""
    history = history or []
    past_edit_unit_ids = past_edit_unit_ids or []

    use_mock = (
        os.environ.get("MOCK_CLAUDE", "1") not in ("0", "false", "False")
        or not os.environ.get("ANTHROPIC_API_KEY")
    )
    if use_mock:
        return _mock(
            inference=inference,
            cohort=cohort,
            units=units,
            timeline=timeline,
            history=history,
            iteration_index=iteration_index,
            past_edit_unit_ids=past_edit_unit_ids,
        )
    try:
        return _live(
            inference=inference,
            frames=frames,
            cohort=cohort,
            units=units,
            timeline=timeline,
            history=history,
            iteration_index=iteration_index,
            past_edit_unit_ids=past_edit_unit_ids,
        )
    except Exception as exc:  # noqa: BLE001 — fail soft, never break the demo
        out = _mock(
            inference=inference,
            cohort=cohort,
            units=units,
            timeline=timeline,
            history=history,
            iteration_index=iteration_index,
            past_edit_unit_ids=past_edit_unit_ids,
        )
        return out.model_copy(update={"summary": f"[live call failed → mock] {exc}\n\n{out.summary}"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cohort_z_dict(inference: InferenceResult) -> dict[str, float]:
    c = inference.video_modality.headline_scores_vs_cohort
    return {
        "attention": c.attention.cohort_z,
        "self_relevance": c.self_relevance.cohort_z,
        "reward": c.reward.cohort_z,
        "disgust": c.disgust.cohort_z,
    }


def _worst_axis(inference: InferenceResult) -> tuple[Axis, float]:
    """Pick the most misaligned axis (by directional badness) and its |z|."""
    cohort = inference.video_modality.headline_scores_vs_cohort
    scored: list[tuple[Axis, float, float]] = [
        ("attention", -cohort.attention.cohort_z, abs(cohort.attention.cohort_z)),
        ("self_relevance", -cohort.self_relevance.cohort_z, abs(cohort.self_relevance.cohort_z)),
        ("reward", -cohort.reward.cohort_z, abs(cohort.reward.cohort_z)),
        ("disgust", cohort.disgust.cohort_z, abs(cohort.disgust.cohort_z)),
    ]
    scored.sort(key=lambda p: p[1], reverse=True)
    return scored[0][0], scored[0][2]


def _severity_bucket(abs_z: float) -> str:
    if abs_z < 0.5:
        return "normal"
    if abs_z < 1.0:
        return "mild"
    if abs_z < 2.0:
        return "moderate"
    return "severe"


def _is_converged(inference: InferenceResult) -> bool:
    cohort = _cohort_z_dict(inference)
    return all(abs(v) < _CONVERGE_ABS_Z for v in cohort.values())


def _argmin(values: list[float]) -> int:
    return min(range(len(values)), key=lambda i: values[i])


def _argmax(values: list[float]) -> int:
    return max(range(len(values)), key=lambda i: values[i])


# ---------------------------------------------------------------------------
# Patch construction (used by mock + as a fallback when Claude returns partial data)
# ---------------------------------------------------------------------------


_SECTION_PRIORITY: dict[str, tuple[str, ...]] = {
    "attention": ("hero", "nav", "features", "cta", "footer"),
    "self_relevance": ("hero", "features", "cta", "nav", "footer"),
    "reward": ("hero", "cta", "features", "nav", "footer"),
    "disgust": ("cta", "hero", "features", "nav", "footer"),
}


def _build_patch(
    *,
    target_axis: Axis,
    severity: str,
    units: list[dict[str, Any]],
    rationale: str,
    exclude_ids: set[str],
) -> PatchProposal | None:
    if not units:
        return None
    section_priority = _SECTION_PRIORITY[target_axis]

    def score(u: dict[str, Any], target_section: str) -> tuple[int, float]:
        if u.get("id") in exclude_ids or u.get("section") != target_section:
            return (-1, 0.0)
        bonus = 0
        text = (u.get("text") or "").strip()
        tag = (u.get("tag") or "").upper()
        if target_axis == "disgust" and (tag == "BUTTON" or "!" in text):
            bonus += 2
        if target_axis == "reward" and tag in ("H1", "H2", "BUTTON"):
            bonus += 1
        if target_axis == "attention" and tag in ("H1", "H2"):
            bonus += 1
        if target_axis == "self_relevance" and tag in ("H1", "H2", "P"):
            bonus += 1
        importance = float((u.get("importance") or {}).get("combined", 0.0))
        return (bonus, importance)

    chosen: dict[str, Any] | None = None
    for sec in section_priority:
        ranked = sorted(
            (u for u in units if u.get("id") not in exclude_ids and u.get("section") == sec),
            key=lambda u: score(u, sec),
            reverse=True,
        )
        if ranked:
            chosen = ranked[0]
            break
    if chosen is None:
        candidates = [u for u in units if u.get("id") not in exclude_ids]
        if not candidates:
            return None
        chosen = candidates[0]

    before = chosen.get("outer_html") or ""
    text = (chosen.get("text") or "").strip() or "Read more"

    # Rewrites calibrated to severity bucket — mild is a nudge, severe rewrites copy.
    if severity == "mild":
        rewrites = {
            "attention":      (text, "Keep copy, tighten one style token to regain fronto-parietal pull."),
            "self_relevance": (text.replace("Our", "Your").replace("our", "your") or text,
                               "Swap 'our' → 'your' — tiny precuneus cue."),
            "reward":         (text, "Preserve wording; slight CTA contrast lift only."),
            "disgust":        (text.replace("!!", "!").rstrip("!") + "" if text.endswith("!!") else text.rstrip("!"),
                               "Remove extra exclamation — soften insula activation."),
        }
    elif severity == "moderate":
        rewrites = {
            "attention":      ("Stop scrolling.", "Restructured to pull fronto-parietal attention."),
            "self_relevance": ("Yours, on day one.", "Addresses the reader directly → recruits precuneus."),
            "reward":         (f"{text.split('.')[0].strip() or 'A clearer path'} — in one tap.",
                               "Adds a concrete reward cue for ventral-striatum prediction."),
            "disgust":        (text.replace("!", "").strip() or "Get started",
                               "Removes exclamation / aggressive punctuation."),
        }
    else:  # severe
        rewrites = {
            "attention":      ("One line. Look here.", "Severe attention drop → wholesale copy rewrite."),
            "self_relevance": ("Built for the way you already work.", "Severe self-relevance gap → reader-first rewrite."),
            "reward":         ("Save ~4 hrs/week starting today.", "Severe reward gap → concrete payoff rewrite."),
            "disgust":        ("Get started", "Severe disgust → strip manipulative cues, restore plain copy."),
        }
    new_text, why = rewrites[target_axis]

    if before and ">" in before and "</" in before:
        head, _, rest = before.partition(">")
        _, _, tail = rest.rpartition("<")
        after = f"{head}>{new_text}<{tail}"
    else:
        after = f'<div data-tribeux-patch="{target_axis}">{new_text}</div>'

    expected = {
        "mild":     0.25 if target_axis != "disgust" else -0.30,
        "moderate": 0.45 if target_axis != "disgust" else -0.55,
        "severe":   0.70 if target_axis != "disgust" else -0.85,
    }[severity]

    return PatchProposal(
        unit_id=chosen.get("id", "unknown"),
        selector=chosen.get("selector", "body"),
        section=chosen.get("section"),
        before_html=before,
        after_html=after,
        rationale=f"{why} {rationale}",
        target_axis=target_axis,
        expected_delta_z=expected,
    )


# ---------------------------------------------------------------------------
# Mock — deterministic, no network
# ---------------------------------------------------------------------------


def _mock(
    *,
    inference: InferenceResult,
    cohort: Cohort,
    units: list[dict[str, Any]],
    timeline: Optional[TimelineBlock],
    history: list[HistoryEntry],
    iteration_index: int,
    past_edit_unit_ids: list[str],
) -> ClaudeFindings:
    ts = inference.video_modality.time_series_zscored
    axis, worst_abs_z = _worst_axis(inference)
    severity = _severity_bucket(worst_abs_z)
    exclude = set(past_edit_unit_ids)

    # Converged — signal done.
    if _is_converged(inference):
        summary = (
            f"All four axes within ±{_CONVERGE_ABS_Z}σ of cohort. No further edits warranted."
        )
        note = "Converged." if history else "Baseline is already healthy."
        return ClaudeFindings(
            summary=summary,
            anomalies=[],
            patches=[],
            asked_for_frame_indices=[],
            model="mock-claude-deterministic",
            mock=True,
            iteration=iteration_index,
            history_note=note,
            done=True,
        )

    # Build anomalies (for the existing Report UI).
    anomalies: list[Anomaly] = []
    for ax in _AXES:
        series = getattr(ts, ax)
        if ax == "disgust":
            t = _argmax(series)
            sev = abs(series[t])
            headline = "Disgust spike — affective friction."
            rationale = f"Insula proxy peaks at t={t}s ({series[t]:+.2f}σ)."
        else:
            t = _argmin(series)
            sev = abs(series[t])
            headline = {
                "attention": "Attention drops — eye loses the page.",
                "self_relevance": "Self-relevance flatlines — reads as broadcast.",
                "reward": "Reward never arrives — striatum stays cold.",
            }[ax]
            rationale = f"{ax.replace('_', ' ').title()} hits {series[t]:+.2f}σ at t={t}s."
        if sev < 0.3:
            continue
        t_lo = max(0, t - 1)
        t_hi = min(len(series) - 1, t + 1)
        anomalies.append(
            Anomaly(
                axis=ax, t_start=t_lo, t_end=t_hi, severity=sev,
                headline=headline, rationale=rationale,
                frame_indices=list(range(t_lo, t_hi + 1)),
            )
        )

    # One patch for the primary worst axis, calibrated to severity.
    patches: list[PatchProposal] = []
    rationale = f"Worst axis vs cohort = {axis} at |z|={worst_abs_z:.2f}σ ({severity})."
    p = _build_patch(
        target_axis=axis,
        severity=severity,
        units=units,
        rationale=rationale,
        exclude_ids=exclude,
    )
    if p is not None:
        patches.append(p)

    asked = sorted({i for a in anomalies for i in a.frame_indices})
    note = _mock_history_note(history, axis)
    summary = (
        f"Iter {iteration_index}. Primary issue: `{axis}` ({severity}, |z|={worst_abs_z:.2f}). "
        f"Proposing 1 edit sized to {severity}. {note}"
    )
    return ClaudeFindings(
        summary=summary,
        anomalies=anomalies,
        patches=patches,
        asked_for_frame_indices=asked,
        model="mock-claude-deterministic",
        mock=True,
        iteration=iteration_index,
        history_note=note,
        done=False,
    )


def _mock_history_note(history: list[HistoryEntry], current_axis: Axis) -> str:
    if not history:
        return "First pass."
    last = history[-1]
    try:
        before = last.cohort_z_before.get(current_axis, 0.0)
        after = last.cohort_z_after.get(current_axis, 0.0)
    except AttributeError:
        return "History available but axis unreadable."
    delta = after - before
    if current_axis == "disgust":
        direction = "down" if delta < 0 else "up"
        helped = delta < 0
    else:
        direction = "up" if delta > 0 else "down"
        helped = delta > 0
    verdict = "continue direction" if helped else "reverse course"
    return f"Last edit moved {current_axis} {direction} by {abs(delta):.2f}σ → {verdict}."


# ---------------------------------------------------------------------------
# Live — Anthropic SDK with vision + timeline + history
# ---------------------------------------------------------------------------


_PROMPT = """You are TribeUX, an iterative UX optimizer running pass N of up to 8 on a live
landing page. After each pass the brain re-scores the page so you can see
whether your prior edits moved the needle.

# Inputs

- headline_cohort: per-axis {cohort_z, percentile}.
  Axes: attention up, self_relevance up, reward up, disgust down (higher = worse).
  |z| bucketing: <0.5 normal | 0.5-1.0 mild | 1.0-2.0 moderate | >=2.0 severe.
- timeline[]: per-second {t, scroll_y, scores_zscored, visible_unit_ids}. Units
  listed at second t were in the viewport when the brain was reacting. TRIBE
  has already compensated for hemodynamic lag.
- worst_moments[]: the seconds most misaligned per axis (use these to pick a unit).
- units[]: DOM inventory - id, section, selector, text, outer_html,
  computed_style, importance.
- history[]: your prior iterations, each with the edits and resulting axis
  deltas. USE THIS. If disgust moved +1.8 -> +1.2, the direction is working;
  continue. If it moved the wrong way, reverse.
- iteration_index, past_edit_unit_ids: never edit a unit already touched.

# Change magnitude MUST match severity

| Worst |z|  | Allowed change
|  <0.5      | Return done=true, no edits.
|  0.5-1.0   | Tiny: one color, one phrase, one style token.
|  1.0-2.0   | Restructure ONE element: CTA copy, contrast, swap image.
|  >=2.0     | Rewrite ONE element wholesale (NOT a whole section).

# Hard rules

- Max 2 edits per pass (1 preferred). Each edit = ONE unit.
- Never redesign or delete a whole section.
- Never modify prices, legal text, brand names, or required disclosures.
- Never remove aria-*, alt=, role=, or change tag semantics (button stays button).
- Never edit a unit listed in past_edit_unit_ids.
- Pick the unit whose visible_unit_ids appearance coincides with the worst
  score seconds. Prefer section matching the construct:
    disgust -> cta/hero | attention -> hero/nav |
    self_relevance -> hero/features | reward -> cta/hero.

# Output - strict JSON, no prose, no code fences

{
  "iteration": <int>,
  "diagnosis": "<1-2 sentences, reference specific t and unit_id>",
  "history_note": "<1 sentence: did my last pass help? continue or pivot>",
  "edits": [
    {"unit_id": "...", "selector": "...", "section": "...",
     "target_axis": "attention|self_relevance|reward|disgust",
     "severity_bucket": "mild|moderate|severe",
     "before_html": "...", "after_html": "...",
     "rationale": "<why THIS edit fixes THIS spike>",
     "expected_delta_z": 0.0}
  ],
  "done": false
}
"""


def _slim_timeline(tb: Optional[TimelineBlock]) -> Optional[dict]:
    """Compact serialization of the timeline block for the prompt payload."""
    if tb is None:
        return None
    return {
        "viewport_h": tb.viewport_h,
        "total_height": tb.total_height,
        "actual_duration_s": tb.actual_duration_s,
        "worst_moments": [m.model_dump() for m in tb.worst_moments],
        "timeline": [
            {
                "t": e.t,
                "scroll_y": e.scroll_y,
                "scores": e.scores_zscored.model_dump(),
                "visible_unit_ids": e.visible_unit_ids,
            }
            for e in tb.timeline
        ],
    }


def _slim_history(history: list[HistoryEntry]) -> list[dict]:
    out: list[dict] = []
    for h in history:
        out.append({
            "iteration": h.iteration,
            "diagnosis": h.diagnosis,
            "cohort_z_before": h.cohort_z_before,
            "cohort_z_after": h.cohort_z_after,
            "edits": [
                {
                    "unit_id": e.unit_id,
                    "selector": e.selector,
                    "target_axis": e.target_axis,
                    "rationale": e.rationale,
                    "expected_delta_z": e.expected_delta_z,
                }
                for e in h.edits
            ],
        })
    return out


def _live(
    *,
    inference: InferenceResult,
    frames: list[Frame],
    cohort: Cohort,
    units: list[dict[str, Any]],
    timeline: Optional[TimelineBlock],
    history: list[HistoryEntry],
    iteration_index: int,
    past_edit_unit_ids: list[str],
) -> ClaudeFindings:
    import anthropic  # imported lazily so the server starts without the SDK

    client = anthropic.Anthropic()

    payload = {
        "iteration_index": iteration_index,
        "past_edit_unit_ids": past_edit_unit_ids,
        "headline_cohort": _cohort_z_dict(inference),
        "inference": json.loads(inference.model_dump_json()),
        "cohort_meta": json.loads(cohort.model_dump_json()),
        "units": units[:30],  # keep prompt size sane
        "timeline": _slim_timeline(timeline),
        "history": _slim_history(history),
    }
    content: list[dict[str, Any]] = [
        {"type": "text", "text": _PROMPT},
        {"type": "text", "text": "DATA:\n" + json.dumps(payload, indent=2)},
    ]
    for f in frames:
        content.append({"type": "text", "text": f"frame_at_{f.t}s"})
        b64 = f.data_url.split(",", 1)[1]
        content.append(
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": b64},
            }
        )

    resp = client.messages.create(
        model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        max_tokens=4096,
        messages=[{"role": "user", "content": content}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    data = _parse_json_object(text)

    # Map Claude's edits[] onto PatchProposal. Be forgiving: some keys may
    # be absent; fall back to values from the matching unit.
    unit_index = {u.get("id"): u for u in units}
    patches: list[PatchProposal] = []
    for e in data.get("edits", []):
        unit_id = e.get("unit_id") or ""
        base = unit_index.get(unit_id, {})
        selector = e.get("selector") or base.get("selector") or "body"
        section = e.get("section") or base.get("section")
        before_html = e.get("before_html") or base.get("outer_html") or ""
        after_html = e.get("after_html") or ""
        rationale = e.get("rationale") or ""
        target_axis = e.get("target_axis") or _worst_axis(inference)[0]
        expected_delta_z = float(e.get("expected_delta_z", 0.0) or 0.0)
        try:
            patches.append(
                PatchProposal(
                    unit_id=unit_id or base.get("id", "unknown"),
                    selector=selector,
                    section=section,
                    before_html=before_html,
                    after_html=after_html,
                    rationale=rationale,
                    target_axis=target_axis,
                    expected_delta_z=expected_delta_z,
                )
            )
        except Exception:  # noqa: BLE001 — skip malformed edits, keep the rest
            continue

    # Synthesize anomalies from worst_moments so the existing UI still has data.
    anomalies: list[Anomaly] = []
    if timeline is not None:
        for m in timeline.worst_moments:
            anomalies.append(
                Anomaly(
                    axis=m.axis,
                    t_start=max(0, m.t - 1),
                    t_end=min(len(inference.video_modality.time_series_zscored.attention) - 1, m.t + 1),
                    severity=abs(m.z),
                    headline=f"{m.axis} {'high' if m.axis == 'disgust' else 'low'} at t={m.t}s",
                    rationale=f"z={m.z:+.2f}σ in viewport containing {len(m.visible_unit_ids)} unit(s).",
                    frame_indices=[max(0, m.t - 1), m.t, min(len(inference.video_modality.time_series_zscored.attention) - 1, m.t + 1)],
                )
            )

    return ClaudeFindings(
        summary=data.get("diagnosis") or data.get("summary") or "",
        anomalies=anomalies,
        patches=patches,
        asked_for_frame_indices=data.get("asked_for_frame_indices", []) or [],
        model=resp.model,
        mock=False,
        iteration=int(data.get("iteration", iteration_index)),
        history_note=data.get("history_note"),
        done=bool(data.get("done", False)),
    )
