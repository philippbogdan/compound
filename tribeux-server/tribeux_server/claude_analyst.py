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


_VISUAL_STYLES: dict[tuple, str] = {
    # axis, severity -> inline CSS that produces an obviously different element.
    ("attention", "mild"):     "font-weight:700; letter-spacing:-0.02em; color:#0f172a;",
    ("attention", "moderate"): "font-size:1.35em; font-weight:800; line-height:1.05; letter-spacing:-0.03em; color:#0f172a;",
    ("attention", "severe"):   "font-size:1.6em; font-weight:900; line-height:1.0; letter-spacing:-0.035em; color:#0f172a; background:linear-gradient(180deg,transparent 60%,#fde68a 60%); display:inline-block; padding:0 6px;",

    ("self_relevance", "mild"):     "color:#111827; font-weight:500;",
    ("self_relevance", "moderate"): "font-size:1.15em; font-weight:600; color:#111827; max-width:30ch;",
    ("self_relevance", "severe"):   "font-size:1.25em; font-weight:600; color:#111827; max-width:28ch; line-height:1.25;",

    ("reward", "mild"):     "background:#0f766e; color:#ffffff; padding:10px 18px; border-radius:8px; font-weight:600; border:none;",
    ("reward", "moderate"): "background:#0f766e; color:#ffffff; padding:14px 26px; border-radius:10px; font-weight:700; font-size:1.05em; box-shadow:0 2px 8px rgba(15,118,110,0.25); border:none;",
    ("reward", "severe"):   "background:linear-gradient(180deg,#10b981,#047857); color:#ffffff; padding:16px 32px; border-radius:12px; font-weight:700; font-size:1.15em; letter-spacing:-0.01em; box-shadow:0 4px 16px rgba(16,185,129,0.35); border:none;",

    ("disgust", "mild"):     "background:#f4f4f5; color:#18181b; font-weight:500; padding:10px 18px; border-radius:8px; border:1px solid #e4e4e7;",
    ("disgust", "moderate"): "background:#ffffff; color:#18181b; font-weight:500; padding:12px 22px; border-radius:10px; border:1px solid #d4d4d8; letter-spacing:0;",
    ("disgust", "severe"):   "background:#ffffff; color:#18181b; font-weight:500; padding:14px 26px; border-radius:10px; border:1px solid #d4d4d8; letter-spacing:0; text-transform:none;",
}


def _inject_inline_style(head: str, css: str) -> str:
    """Replace-or-add `style="..."` inside an opening tag fragment (no trailing `>`)."""
    if not css:
        return head
    import re as _re
    m = _re.search(r'\bstyle\s*=\s*"([^"]*)"', head)
    if m:
        existing = m.group(1).rstrip("; ")
        merged = f'{existing}; {css}'.strip("; ")
        return head[: m.start()] + f'style="{merged}"' + head[m.end() :]
    # Insert after the tag name.
    m2 = _re.match(r"^<\s*([A-Za-z][A-Za-z0-9]*)", head)
    if not m2:
        return head
    end = m2.end()
    return head[:end] + f' style="{css}"' + head[end:]


def _above_fold_unit_ids(
    timeline: Optional[TimelineBlock],
    units: list[dict[str, Any]],
    viewport_h: int = 1024,
) -> set[str]:
    """Return the set of unit IDs visible in the initial viewport (t=0).

    Prefer the timeline's t=0 snapshot; fall back to a bbox.y < viewport_h
    heuristic when the timeline isn't built (e.g. sample mode).
    """
    if timeline and timeline.timeline:
        return set(timeline.timeline[0].visible_unit_ids or [])
    out: set[str] = set()
    for u in units:
        uid = u.get("id")
        if not uid:
            continue
        bb = u.get("bbox") or {}
        try:
            y = float(bb.get("y", 0))
            h = float(bb.get("h", 0))
        except (TypeError, ValueError):
            continue
        if y + h > 0 and y < viewport_h:
            out.add(uid)
    return out


def _build_patch(
    *,
    target_axis: Axis,
    severity: str,
    units: list[dict[str, Any]],
    rationale: str,
    exclude_ids: set[str],
    allowed_ids: Optional[set[str]] = None,
) -> PatchProposal | None:
    if not units:
        return None
    # Above-the-fold filter: only edit units the user sees on arrival.
    if allowed_ids is not None:
        units = [u for u in units if u.get("id") in allowed_ids]
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

    # Copy rewrites scaled to severity.
    if severity == "mild":
        rewrites = {
            "attention":      (text, "Keep copy, lift typography for a visible attention anchor."),
            "self_relevance": (text.replace("Our", "Your").replace("our", "your") or text,
                               "Swap 'our' → 'your' and bump readability — precuneus cue."),
            "reward":         (text, "Preserve wording; promote the CTA visually."),
            "disgust":        (text.replace("!!", "!").rstrip("!") if text.endswith("!") else text,
                               "Remove exclamation; neutralize aggressive tone."),
        }
    elif severity == "moderate":
        rewrites = {
            "attention":      ("Stop scrolling.", "Restructured headline to pull fronto-parietal attention."),
            "self_relevance": ("Yours, on day one.", "Addresses the reader directly → recruits precuneus."),
            "reward":         (f"{text.split('.')[0].strip() or 'A clearer path'} — in one tap.",
                               "Added a concrete reward cue for ventral-striatum prediction."),
            "disgust":        (text.replace("!", "").strip() or "Get started",
                               "Stripped exclamation; softened insula activation."),
        }
    else:  # severe
        rewrites = {
            "attention":      ("One line. Look here.", "Severe attention drop → wholesale typography rewrite."),
            "self_relevance": ("Built for the way you already work.", "Severe self-relevance gap → reader-first rewrite."),
            "reward":         ("Save ~4 hrs/week starting today.", "Severe reward gap → concrete payoff + amplified CTA."),
            "disgust":        ("Get started", "Severe disgust → strip manipulative cues, restore plain copy."),
        }
    new_text, why = rewrites[target_axis]

    # Build after_html: inject inline style for visible change + new text.
    css = _VISUAL_STYLES.get((target_axis, severity), "")
    if before and ">" in before and "</" in before:
        head, _, rest = before.partition(">")
        _, _, tail = rest.rpartition("<")
        styled_head = _inject_inline_style(head, css)
        after = f"{styled_head}>{new_text}<{tail}"
    else:
        after = f'<div data-tribeux-patch="{target_axis}" style="{css}">{new_text}</div>'

    expected = {
        "mild":     0.30 if target_axis != "disgust" else -0.30,
        "moderate": 0.55 if target_axis != "disgust" else -0.55,
        "severe":   0.90 if target_axis != "disgust" else -0.95,
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
    allowed = _above_fold_unit_ids(timeline, units)
    p = _build_patch(
        target_axis=axis,
        severity=severity,
        units=units,
        rationale=rationale,
        exclude_ids=exclude,
        allowed_ids=allowed,
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


_PROMPT = """You are TribeUX, an iterative UX optimizer running pass N of up to 8 on a
live landing page. After each pass the brain re-scores the patched page so
you can see whether your last edit actually moved the needle.

Your edits MUST make a visible, tangible change a user would notice within
one second of looking at the page. Copy-only tweaks that don't change how
the page *looks* are failures. Think like a designer shipping a small but
real redesign every pass — not a copywriter.

# Inputs

- headline_cohort: per-axis {cohort_z, percentile}. Axes:
    attention (higher = more engaged),
    self_relevance (higher = feels personal),
    reward (higher = anticipated value),
    disgust (lower = less friction; high = worse).
  Severity buckets by |z|: <0.5 normal | 0.5-1.0 mild | 1.0-2.0 moderate | >=2.0 severe.
- timeline[]: per-second {t, scroll_y, scores, visible_unit_ids}. The units
  listed at second t were in the viewport when the brain reacted. TRIBE has
  already compensated for hemodynamic lag, so trust the t.
- worst_moments[]: per-axis worst seconds — start diagnosis here.
- units[]: DOM inventory — id, section, selector, text, outer_html,
  computed_style, importance. Read computed_style to match the existing
  palette/font/spacing so your edit integrates instead of clashing.
- history[]: your prior passes with measured cohort_z_before vs after on
  the targeted axis. Continue the direction when it worked; pivot angle
  or axis when it didn't.
- past_edit_unit_ids: never edit one of these again.

# How patches are applied (exploit this)

Each edit replaces an element via `el.outerHTML = after_html`. That means:

1. **Inline `style="..."` in after_html overrides site CSS by specificity.**
   Use it liberally — this is your most reliable lever for visible change.
2. You may replace the tag's inner structure (children, nested spans,
   SVG) freely so long as you preserve semantic role + attributes.
3. You CANNOT rely on adding external stylesheets or <style> tags.

Every edit should change at least TWO visible properties together
(color + size, padding + weight, background + border-radius, etc.) so the
difference is obvious at a glance.

# Design toolbox per axis

- disgust → soften aggressive reds/oranges toward neutral or brand-primary;
  strip "!", "LIMITED", "ONLY TODAY" shouting; drop font-weight below 700;
  add generous padding; decrease font-size if it's screaming. Reduce
  competing visual noise around the offender.
- attention → enlarge hero/heading (+20-40%), bolder weight, tighter
  line-height; add one accent element (underline, pill, colored dot) on
  the key phrase; flatten competing on-screen elements.
- self_relevance → swap "our/we" for "your/you"; add a second-person
  subtitle; reference a concrete role or use case; humanize with an
  avatar/illustration if appropriate.
- reward → make the value proposition concrete (a time savings, a dollar
  number, a specific outcome); raise CTA visual weight (larger padding,
  higher contrast, breathing room); add a micro-benefit line under CTA.

# Change magnitude MUST match severity

| Worst |z| | Edit count | Per-edit scope                                            |
| <0.5      | 0 — set done=true and return empty edits                                |
| 0.5-1.0   | 1          | Restyle one element: combine color + weight + spacing changes so the element clearly looks different. |
| 1.0-2.0   | 2          | Restyle + rewrite one key element AND adjust an adjacent one (e.g., hero title + CTA, headline + subhead). |
| >=2.0     | 2-3        | Replace 1-2 elements wholesale with new HTML + inline styles, plus one supporting element adjustment. |

Target expected_delta_z proportional to severity:
mild ±0.2-0.4 · moderate ±0.4-0.7 · severe ±0.7-1.2.
Direction: positive on attention/self_relevance/reward, negative on disgust.

# Hard rules — non-negotiable

- ONLY edit units that appear in `timeline[0].visible_unit_ids` — i.e. the
  FIRST GLIMPSE of the page (above the fold, viewport_h = 1024px). Elements
  the user would only see after scrolling don't form the first impression
  the brain responds to. If worst_moments spikes are below the fold, still
  pick an above-fold unit — you're editing what the user actually sees on
  arrival.
- Never redesign or delete a whole section (nav/hero/features/cta/footer).
- Never modify prices, legal text, brand names, or required disclosures.
- Never strip aria-*, alt, role, or change a tag's semantic role
  (button stays button; a stays a). You MAY change style=, class=, inner
  text, nested elements, and inline SVG.
- Preserve id, href, type, name, data-* attributes that scripts may rely on.
- Never edit a unit listed in past_edit_unit_ids.
- Pick the unit whose visible_unit_ids appearance most coincides with the
  worst score seconds. Prefer section matching construct:
    disgust → cta/hero · attention → hero/nav ·
    self_relevance → hero/features · reward → cta/hero.

# Output — strict JSON, no prose, no code fences

{
  "iteration": <int>,
  "diagnosis": "<1-2 sentences: what the brain is reacting to, at which t, which unit_id>",
  "history_note": "<1 sentence: did last pass move the targeted axis? continue or pivot>",
  "edits": [
    {"unit_id": "...", "selector": "...", "section": "...",
     "target_axis": "attention|self_relevance|reward|disgust",
     "severity_bucket": "mild|moderate|severe",
     "before_html": "<original outer_html>",
     "after_html": "<new html WITH inline style= overriding palette/layout>",
     "rationale": "<why THIS specific visual change fixes THIS specific spike>",
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
    # be absent; fall back to values from the matching unit. Drop any edit
    # targeting a unit outside the initial viewport (hard rule in prompt,
    # but belt-and-braces in case the model ignores it).
    unit_index = {u.get("id"): u for u in units}
    above_fold = _above_fold_unit_ids(timeline, units)
    patches: list[PatchProposal] = []
    for e in data.get("edits", []):
        unit_id = e.get("unit_id") or ""
        if above_fold and unit_id not in above_fold:
            # Skip below-the-fold edits silently — a dropped patch is
            # better than editing something the user never sees.
            continue
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
