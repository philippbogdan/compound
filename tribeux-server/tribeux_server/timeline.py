"""Time→DOM visibility mapping + iteration-history resolution.

`build_timeline` turns the scroll telemetry returned by `URLRecorder`
into an explicit per-second picture of *which DOM units the brain was
looking at when*. That saves Claude from having to eyeball which
element caused which score spike.

`resolve_history` walks the parent-job chain and assembles the prior
iterations' edits + cohort-z deltas so Claude can see whether its last
pass helped.
"""
from __future__ import annotations

from typing import Any, Optional

from .schemas import (
    HeadlineVsCohort,
    HistoryEdit,
    HistoryEntry,
    InferenceResult,
    TimelineBlock,
    TimelineEntry,
    TimelineScores,
    WorstMoment,
)


_AXES: tuple[str, ...] = ("attention", "self_relevance", "reward", "disgust")
_DEFAULT_VIEWPORT_H = 1024


# ---------------------------------------------------------------------------
# Scroll-log lookup
# ---------------------------------------------------------------------------


def scroll_y_at(scroll_log: list[list[float]], t: float) -> float:
    """Linearly interpolate the recorded scroll_log at time `t` (seconds).

    `scroll_log` is a list of [elapsed_s, scroll_y] pairs emitted by the
    in-page RAF loop. Samples are frame-synced (~16 ms apart) so linear
    interpolation is effectively exact at 1 Hz resolution.
    """
    if not scroll_log:
        return 0.0
    if t <= scroll_log[0][0]:
        return float(scroll_log[0][1])
    if t >= scroll_log[-1][0]:
        return float(scroll_log[-1][1])
    # Binary search would be nicer but the log is tiny (~600 samples for 10 s).
    for i in range(1, len(scroll_log)):
        t1, y1 = scroll_log[i]
        if t1 >= t:
            t0, y0 = scroll_log[i - 1]
            span = t1 - t0
            if span <= 0:
                return float(y1)
            u = (t - t0) / span
            return float(y0 + (y1 - y0) * u)
    return float(scroll_log[-1][1])


# ---------------------------------------------------------------------------
# Visibility check
# ---------------------------------------------------------------------------


def _is_sticky(unit: dict[str, Any]) -> bool:
    """Treat position:{fixed,sticky} elements as always-visible."""
    style = unit.get("computed_style") or {}
    pos = (style.get("position") or "").lower()
    return pos in ("fixed", "sticky")


def _bbox_yh(unit: dict[str, Any]) -> tuple[float, float] | None:
    bb = unit.get("bbox") or {}
    try:
        y = float(bb.get("y", 0))
        h = float(bb.get("h", 0))
    except (TypeError, ValueError):
        return None
    return y, h


def visible_unit_ids(
    units: list[dict[str, Any]],
    scroll_y: float,
    viewport_h: int,
) -> list[str]:
    """Return unit ids whose bbox vertically overlaps the current viewport."""
    top = scroll_y
    bottom = scroll_y + viewport_h
    out: list[str] = []
    for u in units:
        uid = u.get("id")
        if not uid:
            continue
        if _is_sticky(u):
            out.append(uid)
            continue
        yh = _bbox_yh(u)
        if yh is None:
            continue
        y, h = yh
        unit_top = y
        unit_bottom = y + h
        if unit_bottom > top and unit_top < bottom:
            out.append(uid)
    return out


# ---------------------------------------------------------------------------
# Timeline builder
# ---------------------------------------------------------------------------


def _series_at(series: list[float], t: int) -> float:
    if not series:
        return 0.0
    t = max(0, min(t, len(series) - 1))
    return float(series[t])


def build_timeline(
    units: list[dict[str, Any]],
    scroll_log: list[list[float]],
    inference: InferenceResult,
    *,
    viewport_h: int = _DEFAULT_VIEWPORT_H,
    total_height: Optional[int] = None,
    actual_duration_s: Optional[float] = None,
) -> TimelineBlock:
    """Build a per-second timeline of visible units + scores.

    Worst moments are picked per-axis: top 3 seconds by directional badness
    (max for disgust, min for the other three). De-duped by timestep.
    """
    ts = inference.video_modality.time_series_zscored
    T = len(ts.attention)

    entries: list[TimelineEntry] = []
    for t in range(T):
        y = scroll_y_at(scroll_log, float(t))
        vids = visible_unit_ids(units, y, viewport_h)
        entries.append(
            TimelineEntry(
                t=t,
                scroll_y=round(y, 2),
                scores_zscored=TimelineScores(
                    attention=_series_at(ts.attention, t),
                    self_relevance=_series_at(ts.self_relevance, t),
                    reward=_series_at(ts.reward, t),
                    disgust=_series_at(ts.disgust, t),
                ),
                visible_unit_ids=vids,
            )
        )

    # Pick worst moments per axis (top 3 each).
    worst: list[WorstMoment] = []
    seen_keys: set[tuple[int, str]] = set()
    for axis in _AXES:
        series = getattr(ts, axis)
        indexed = list(enumerate(series))
        if axis == "disgust":
            indexed.sort(key=lambda p: p[1], reverse=True)  # high = bad
        else:
            indexed.sort(key=lambda p: p[1])  # low = bad
        for t, z in indexed[:3]:
            key = (t, axis)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            vids = entries[t].visible_unit_ids if 0 <= t < len(entries) else []
            worst.append(
                WorstMoment(t=t, axis=axis, z=round(float(z), 3), visible_unit_ids=vids)
            )

    return TimelineBlock(
        timeline=entries,
        worst_moments=worst,
        total_height=int(total_height) if total_height is not None else None,
        actual_duration_s=actual_duration_s,
        viewport_h=viewport_h,
    )


# ---------------------------------------------------------------------------
# History resolution (chain walk)
# ---------------------------------------------------------------------------


def _cohort_dict(headline: HeadlineVsCohort) -> dict[str, float]:
    return {
        "attention": headline.attention.cohort_z,
        "self_relevance": headline.self_relevance.cohort_z,
        "reward": headline.reward.cohort_z,
        "disgust": headline.disgust.cohort_z,
    }


def _walk_chain(store, job_id: Optional[str]) -> list:
    """Return jobs from oldest → newest along the parent chain (inclusive)."""
    if not job_id:
        return []
    seen: set[str] = set()
    ordered: list = []
    cur = store.get(job_id)
    while cur and cur.id not in seen:
        seen.add(cur.id)
        ordered.append(cur)
        cur = store.get(cur.parent_job_id) if getattr(cur, "parent_job_id", None) else None
    ordered.reverse()
    return ordered


def resolve_history(
    store,
    parent_job_id: Optional[str],
    *,
    current_cohort: Optional[dict[str, float]] = None,
) -> tuple[list[HistoryEntry], list[str], int]:
    """Walk the parent chain and build `HistoryEntry` list.

    Returns `(history, past_edit_unit_ids, next_iteration_index)`.

    `current_cohort` (optional) = the cohort_z dict we just measured for
    the in-flight iteration. When provided, fills the `cohort_z_after` of
    the most recent history entry so Claude can see the delta its last
    edit produced.
    """
    if not parent_job_id:
        return [], [], 0

    chain = _walk_chain(store, parent_job_id)
    history: list[HistoryEntry] = []
    past_unit_ids: list[str] = []

    for i, job in enumerate(chain):
        if not job.result:
            continue
        rep = job.result
        cohort_before = _cohort_dict(rep.v1.video_modality.headline_scores_vs_cohort)

        # Pick cohort_after from the next job in the chain, or from
        # current_cohort for the very last entry.
        if i + 1 < len(chain) and chain[i + 1].result:
            cohort_after = _cohort_dict(
                chain[i + 1].result.v1.video_modality.headline_scores_vs_cohort
            )
        elif current_cohort is not None:
            cohort_after = dict(current_cohort)
        else:
            cohort_after = dict(cohort_before)  # unknown yet

        edits: list[HistoryEdit] = []
        for p in rep.findings.patches:
            edits.append(
                HistoryEdit(
                    unit_id=p.unit_id,
                    selector=p.selector,
                    target_axis=p.target_axis,
                    before_html=p.before_html[:800],
                    after_html=p.after_html[:800],
                    rationale=p.rationale,
                    expected_delta_z=p.expected_delta_z,
                )
            )
            past_unit_ids.append(p.unit_id)

        history.append(
            HistoryEntry(
                iteration=rep.iteration_index,
                job_id=job.id,
                diagnosis=rep.findings.summary,
                edits=edits,
                cohort_z_before=cohort_before,
                cohort_z_after=cohort_after,
            )
        )

    next_iter = chain[-1].result.iteration_index + 1 if (chain and chain[-1].result) else len(chain)
    return history, past_unit_ids, next_iter


# ---------------------------------------------------------------------------
# Patch-script builder (combines prior-iteration patches into one JS blob)
# ---------------------------------------------------------------------------


def build_patch_script(history: list[HistoryEntry]) -> str:
    """Serialize every prior iteration's edits as a single JS string.

    Each edit is applied via `document.querySelector(selector).outerHTML =
    after_html`. Bad selectors are logged and skipped — one dead patch
    must not nuke the rest.
    """
    if not history:
        return ""
    lines: list[str] = []
    for entry in history:
        for e in entry.edits:
            sel_js = _js_string(e.selector)
            html_js = _js_string(e.after_html)
            lines.append(
                "try {\n"
                f"  const el = document.querySelector({sel_js});\n"
                f"  if (el) el.outerHTML = {html_js};\n"
                "} catch (err) { console.warn('tribeux patch failed', err); }"
            )
    return "\n".join(lines)


def _js_string(s: str) -> str:
    """JSON-encode a string for safe interpolation into JS source."""
    import json as _json

    return _json.dumps(s)
