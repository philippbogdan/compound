"""Stub TRIBE v2 inference.

This is intentionally a no-op: it returns the JSON the user asserted is
the correct output shape (samples/site_1.json), with the URL and
timestamp filled in. The pipeline is wired to call this *exactly the
way it would call a real model*, so swapping in real TRIBE v2 inference
later only requires replacing this function.
"""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from .schemas import Frame, InferenceResult

_SAMPLES = Path(__file__).resolve().parent.parent / "samples"


@lru_cache(maxsize=1)
def _base_inference() -> dict:
    with (_SAMPLES / "site_1.json").open() as f:
        return json.load(f)


def run_tribe_inference(
    url: str,
    frames: list[Frame],
    *,
    site_id: str = "site_1",
    label: str | None = None,
    pipeline_version: str = "tribeux_v0.1_stub",
) -> InferenceResult:
    """Return an `InferenceResult` for the given URL.

    In production this would consume `frames` and run the TRIBE v2
    encoder. Here we just fill in metadata so downstream stages see a
    valid payload that lines up with the captured frames.
    """
    base = copy.deepcopy(_base_inference())
    base["site_id"] = site_id
    base["label"] = label or site_id
    base["metadata"]["url_or_description"] = url
    base["metadata"]["tribe_timesteps"] = len(frames) or base["metadata"]["tribe_timesteps"]
    base["metadata"]["scored_at_utc"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    base["metadata"]["pipeline_version"] = pipeline_version
    return InferenceResult.model_validate(base)


def run_v2_inference(
    url: str,
    frames: list[Frame],
    v1: InferenceResult,
    expected_uplift_per_axis: dict[str, float],
) -> InferenceResult:
    """Return a v2 `InferenceResult` reflecting the predicted uplift.

    Each axis's `cohort_z` and `percentile` are nudged by the expected
    delta. We also shift the time series upward by the same amount so
    the report's curves visibly improve. This keeps the contract with
    the schema while making the stub's "after" plausibly different.
    """
    v2 = v1.model_copy(deep=True)
    v2.site_id = f"{v1.site_id}_v2"
    v2.label = f"{v1.label} (v2)"
    v2.metadata.pipeline_version = f"{v1.metadata.pipeline_version}+v2"

    for axis, delta in expected_uplift_per_axis.items():
        cohort = getattr(v2.video_modality.headline_scores_vs_cohort, axis)
        cohort.cohort_z += delta
        cohort.percentile = max(0.0, min(100.0, cohort.percentile + delta * 12))
        ts_z = getattr(v2.video_modality.time_series_zscored, axis)
        for i in range(len(ts_z)):
            ts_z[i] += delta * 0.6
        within = v2.video_modality.headline_scores_within_site
        setattr(within, axis, getattr(within, axis) + delta * 0.05)

    overall = sum(expected_uplift_per_axis.values())
    v2.video_modality.headline_scores_within_site.overall = (
        v1.video_modality.headline_scores_within_site.overall + overall * 0.1
    )
    return v2
