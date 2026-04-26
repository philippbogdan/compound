"""Claude analyst.

Given the time-series + per-second frames + cohort baselines + DOM
units, Claude returns:

- `anomalies`: timestep windows where an axis diverges from the cohort
- `patches`: concrete DOM-unit edits (selector + before_html + after_html)
  with a target axis and an expected delta on `cohort_z`
- `summary`: one-paragraph narrative

If `MOCK_CLAUDE=1` (or no API key is configured), a deterministic
mock is returned that picks the worst axis from the cohort z-scores
and proposes a copy edit on the highest-importance unit in that
axis's likely section.
"""
from __future__ import annotations

import json
import os
from typing import Any

from .schemas import (
    Anomaly,
    Axis,
    ClaudeFindings,
    Cohort,
    Frame,
    InferenceResult,
    PatchProposal,
)

_AXES: tuple[Axis, ...] = ("attention", "self_relevance", "reward", "disgust")


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------


def analyze(
    *,
    inference: InferenceResult,
    frames: list[Frame],
    cohort: Cohort,
    units: list[dict[str, Any]],
) -> ClaudeFindings:
    """Run the analyst. Falls back to a deterministic mock when keys/env say so."""
    use_mock = (
        os.environ.get("MOCK_CLAUDE", "1") not in ("0", "false", "False")
        or not os.environ.get("ANTHROPIC_API_KEY")
    )
    if use_mock:
        return _mock(inference=inference, cohort=cohort, units=units)
    try:
        return _live(inference=inference, frames=frames, cohort=cohort, units=units)
    except Exception as exc:  # noqa: BLE001 — fail soft, never break the demo
        out = _mock(inference=inference, cohort=cohort, units=units)
        return out.model_copy(update={"summary": f"[live call failed → mock] {exc}\n\n{out.summary}"})


# ---------------------------------------------------------------------------
# Mock — deterministic, no network
# ---------------------------------------------------------------------------


def _worst_axis(inference: InferenceResult) -> Axis:
    """Pick the axis whose direction is worst vs cohort.

    For `disgust`, positive cohort_z is worse (more disgust); for the
    other three, negative cohort_z is worse (less attention/reward/self).
    """
    cohort = inference.video_modality.headline_scores_vs_cohort
    scored: list[tuple[Axis, float]] = [
        ("attention", -cohort.attention.cohort_z),
        ("self_relevance", -cohort.self_relevance.cohort_z),
        ("reward", -cohort.reward.cohort_z),
        ("disgust", cohort.disgust.cohort_z),
    ]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[0][0]


def _argmin(values: list[float]) -> int:
    return min(range(len(values)), key=lambda i: values[i])


def _argmax(values: list[float]) -> int:
    return max(range(len(values)), key=lambda i: values[i])


def _build_patch(
    *,
    target_axis: Axis,
    units: list[dict[str, Any]],
    rationale: str,
    exclude_ids: set[str] | None = None,
) -> PatchProposal | None:
    if not units:
        return None
    exclude_ids = exclude_ids or set()
    section_priority = {
        "attention": ("hero", "nav", "features", "cta", "footer"),
        "self_relevance": ("hero", "features", "cta", "nav", "footer"),
        "reward": ("hero", "cta", "features", "nav", "footer"),
        "disgust": ("cta", "hero", "features", "nav", "footer"),
    }[target_axis]

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
        chosen = candidates[0] if candidates else units[0]

    before = chosen.get("outer_html") or ""
    text = (chosen.get("text") or "").strip() or "Read more"

    rewrites = {
        "attention": ("Stop scrolling.", "Pulls fronto-parietal attention to the headline."),
        "self_relevance": ("Yours, on day one.", "Recruits the precuneus by addressing the reader directly."),
        "reward": (f"{text.split('.')[0].strip() or 'A clearer path'} — in one tap.",
                   "Adds a concrete reward cue to lift ventral-striatum prediction."),
        "disgust": (text.replace("!", "").strip() or "Get started",
                    "Removes the exclamation and softens insula activation."),
    }
    new_text, why = rewrites[target_axis]

    if before and ">" in before and "</" in before:
        head, _, rest = before.partition(">")
        _, _, tail = rest.rpartition("<")
        after = f"{head}>{new_text}<{tail}"
    else:
        after = f'<div data-tribeux-patch="{target_axis}">{new_text}</div>'

    return PatchProposal(
        unit_id=chosen.get("id", "unknown"),
        selector=chosen.get("selector", "body"),
        section=chosen.get("section"),
        before_html=before,
        after_html=after,
        rationale=f"{why} {rationale}",
        target_axis=target_axis,
        expected_delta_z=0.45 if target_axis != "disgust" else -0.55,
    )


def _mock(
    *,
    inference: InferenceResult,
    cohort: Cohort,
    units: list[dict[str, Any]],
) -> ClaudeFindings:
    ts = inference.video_modality.time_series_zscored
    axis = _worst_axis(inference)

    anomalies: list[Anomaly] = []
    for ax in _AXES:
        series = getattr(ts, ax)
        if ax == "disgust":
            t = _argmax(series)
            severity = abs(series[t])
            if severity < 0.3:
                continue
            headline = "Disgust spike — affective friction at the CTA."
            rationale = (
                f"Insula proxy peaks at t={t}s ({series[t]:+.2f}σ). "
                "Likely caused by a high-contrast, exclamation-heavy element."
            )
        else:
            t = _argmin(series)
            severity = abs(series[t])
            if severity < 0.3:
                continue
            headline = {
                "attention": "Attention drops — the eye loses the page.",
                "self_relevance": "Self-relevance flatlines — the page reads as broadcast, not address.",
                "reward": "Reward never arrives — the ventral striatum stays cold.",
            }[ax]
            rationale = (
                f"{ax.replace('_', ' ').title()} hits {series[t]:+.2f}σ at t={t}s, "
                f"{cohort.interpretation.get(ax, '')}."
            )
        t_lo = max(0, t - 1)
        t_hi = min(len(series) - 1, t + 1)
        anomalies.append(
            Anomaly(
                axis=ax,
                t_start=t_lo,
                t_end=t_hi,
                severity=severity,
                headline=headline,
                rationale=rationale,
                frame_indices=list(range(t_lo, t_hi + 1)),
            )
        )

    patches: list[PatchProposal] = []
    seen_axes: set[str] = set()
    used_units: set[str] = set()
    for a in sorted(anomalies, key=lambda a: -a.severity)[:3]:
        if a.axis in seen_axes:
            continue
        seen_axes.add(a.axis)
        p = _build_patch(
            target_axis=a.axis, units=units, rationale=a.rationale, exclude_ids=used_units
        )
        if p is not None:
            patches.append(p)
            used_units.add(p.unit_id)

    asked = sorted({i for a in anomalies for i in a.frame_indices})
    summary = (
        f"Worst axis vs cohort is `{axis}`. "
        f"Found {len(anomalies)} anomaly window(s); proposing {len(patches)} edit(s) "
        "ranked by expected uplift on the misaligned axis."
    )
    return ClaudeFindings(
        summary=summary,
        anomalies=anomalies,
        patches=patches,
        asked_for_frame_indices=asked,
        model="mock-claude-deterministic",
        mock=True,
    )


# ---------------------------------------------------------------------------
# Live — Anthropic SDK with vision
# ---------------------------------------------------------------------------


_PROMPT = """You are TribeUX's anomaly analyst.

You receive:
  - per-axis time-series (z-scored vs an n=30 landing-page cohort)
  - per-axis headline cohort_z + percentile
  - one image per timestep (frame_at_<t>s)
  - a list of DOM units with id, section, selector, importance, outer_html, text

Your job is to:
  1) Identify the most misaligned timestep windows per axis.
     Disgust: large positive cohort_z is bad. The other three: large negative is bad.
  2) Choose up to 3 DOM units to edit and propose new_html for each.
  3) Estimate the change in cohort_z on the targeted axis.

Return JSON exactly matching this schema (no prose, no code fences):
{
  "summary": "<one paragraph>",
  "anomalies": [
    {"axis": "...", "t_start": 0, "t_end": 0, "severity": 0.0,
     "headline": "...", "rationale": "...", "frame_indices": [0]}
  ],
  "patches": [
    {"unit_id": "...", "selector": "...", "section": "...",
     "before_html": "...", "after_html": "...",
     "rationale": "...", "target_axis": "...", "expected_delta_z": 0.0}
  ],
  "asked_for_frame_indices": [0]
}
"""


def _live(
    *,
    inference: InferenceResult,
    frames: list[Frame],
    cohort: Cohort,
    units: list[dict[str, Any]],
) -> ClaudeFindings:
    import anthropic  # imported lazily so the server starts without the SDK

    client = anthropic.Anthropic()

    payload = {
        "inference": json.loads(inference.model_dump_json()),
        "cohort": json.loads(cohort.model_dump_json()),
        "units": units[:30],  # keep prompt size sane
    }
    content: list[dict[str, Any]] = [
        {"type": "text", "text": _PROMPT},
        {"type": "text", "text": "DATA:\n" + json.dumps(payload, indent=2)},
    ]
    for f in frames:
        # frame_at_<t>s captioning — keeps Claude's references stable.
        content.append({"type": "text", "text": f"frame_at_{f.t}s"})
        b64 = f.data_url.split(",", 1)[1]
        content.append(
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": b64},
            }
        )

    resp = client.messages.create(
        model=os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"),
        max_tokens=4096,
        messages=[{"role": "user", "content": content}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    data = json.loads(text)
    return ClaudeFindings(
        summary=data["summary"],
        anomalies=[Anomaly.model_validate(a) for a in data.get("anomalies", [])],
        patches=[PatchProposal.model_validate(p) for p in data.get("patches", [])],
        asked_for_frame_indices=data.get("asked_for_frame_indices", []),
        model=resp.model,
        mock=False,
    )
