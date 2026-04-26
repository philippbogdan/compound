"""TRIBE v2 inference.

Two paths:

- **Live** — when `TRIBE_INFERENCE_URL` is set (and `MOCK_TRIBE` is not
  truthy), the captured frames are encoded into an mp4 with ffmpeg and
  POSTed to `<URL>/score` as multipart `video`. The response JSON is
  parsed straight into `InferenceResult`.

- **Stub** — fallback when no URL is configured *or* when the live call
  raises. Returns the JSON shape from `samples/site_1.json` with the URL
  and timestamp filled in. Same contract as live so the pipeline doesn't
  branch.

`run_v2_inference` is always the deterministic stub-shifter — the v2
re-inference is a *predicted* delta over v1, not a second model call.
"""
from __future__ import annotations

import asyncio
import base64
import copy
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import httpx

from .schemas import Frame, InferenceResult

_SAMPLES = Path(__file__).resolve().parent.parent / "samples"
_SCORE_TIMEOUT_S = 300


@lru_cache(maxsize=1)
def _base_inference() -> dict:
    with (_SAMPLES / "site_1.json").open() as f:
        return json.load(f)


def _use_real_tribe() -> bool:
    if os.environ.get("MOCK_TRIBE", "0") in ("1", "true", "True"):
        return False
    return bool(os.environ.get("TRIBE_INFERENCE_URL"))


def _frames_to_mp4(frames: list[Frame], fps: int = 1) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for f in frames:
            png_b64 = f.data_url.split(",", 1)[-1]
            (tmp_path / f"f_{f.t:03d}.png").write_bytes(base64.b64decode(png_b64))
        out = tmp_path / "score.mp4"
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-framerate", str(fps),
                "-i", str(tmp_path / "f_%03d.png"),
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                str(out),
            ],
            check=True,
        )
        return out.read_bytes()


async def _post_score(video_bytes: bytes, *, label: str, filename: str = "video.mp4") -> dict:
    base = os.environ["TRIBE_INFERENCE_URL"].rstrip("/")
    async with httpx.AsyncClient(timeout=_SCORE_TIMEOUT_S) as client:
        r = await client.post(
            f"{base}/score",
            files={"video": (filename, video_bytes, "video/mp4")},
            data={"label": label},
            headers={"ngrok-skip-browser-warning": "true"},
        )
    r.raise_for_status()
    return r.json()


async def run_tribe_inference(
    url: str,
    frames: list[Frame],
    *,
    site_id: str = "site_1",
    label: str | None = None,
    pipeline_version: str = "tribeux_v0.1_stub",
    video_path: str | None = None,
    log: "callable | None" = None,
) -> InferenceResult:
    """Score the rendered video for `url` and return an `InferenceResult`.

    Prefers `video_path` when provided (mp4 produced by `render.render_url`).
    Falls back to encoding `frames` into an mp4 with ffmpeg.

    `log(message)` is called with one-line status updates that should
    surface in the SSE log (so live-mode failures are visible to the
    operator, not silently degraded).
    """
    def _say(msg: str) -> None:
        if log is not None:
            try:
                log(msg)
            except Exception:  # noqa: BLE001
                pass
        else:
            print(f"[inference] {msg}", file=sys.stderr)

    if _use_real_tribe() and (video_path or frames):
        try:
            if video_path:
                from pathlib import Path as _Path
                video = _Path(video_path).read_bytes()
                filename = _Path(video_path).name
                _say(f"posting video {filename} ({len(video)/1024:.1f} KB) → /score")
            else:
                video = await asyncio.to_thread(_frames_to_mp4, frames)
                filename = "frames.mp4"
                _say(f"posting frames.mp4 ({len(video)/1024:.1f} KB) → /score")
            data = await _post_score(video, label=label or site_id, filename=filename)
            data.setdefault("metadata", {})
            data["metadata"]["url_or_description"] = url
            data["metadata"]["scored_at_utc"] = datetime.now(timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%S.%fZ"
            )
            data["metadata"]["pipeline_version"] = "tribeux_v0.1_live"
            _say("/score returned 200 · live inference accepted")
            return InferenceResult.model_validate(data)
        except Exception as exc:  # noqa: BLE001
            # Surface the failure to the SSE log so the operator sees
            # the degradation; the pipeline still completes against the
            # stub so the demo doesn't break.
            _say(f"/score live call failed → stub fallback: {exc!r}")

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
    the report's curves visibly improve.
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
