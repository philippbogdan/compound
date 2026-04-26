"""Disk-backed Report cache for demo mode.

Each `run_pipeline` invocation takes ~1-3 min (TRIBE round-trip dominates).
For repeat demos of the same URL + patch_script, that's dead weight. This
module lets us save the entire Report (plus the logs, checkpoints, and
progress events that narrated the pipeline, AND the scroll-capture mp4)
so the next run can replay them fast, with the video already on disk.

Enable with env `TRIBEUX_CACHE=1`. Override location with
`TRIBEUX_CACHE_DIR` (default `/tmp/tribeux_cache`). Force a recompute
with `TRIBEUX_CACHE_BYPASS=1` (useful when iterating on the prompt).

Cache key = sha256(url + patch_script + pipeline_version). `patch_script`
captures the accumulated edits from prior iterations, so iteration 2's
cache entry is distinct from iteration 1's even on the same URL.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
from pathlib import Path
from typing import Any, Optional

from .schemas import Report


_PIPELINE_VERSION = "tribeux_v0.2_iter"


def enabled() -> bool:
    return os.environ.get("TRIBEUX_CACHE", "0") in ("1", "true", "True")


def bypass() -> bool:
    return os.environ.get("TRIBEUX_CACHE_BYPASS", "0") in ("1", "true", "True")


def _cache_dir() -> Path:
    d = Path(os.environ.get("TRIBEUX_CACHE_DIR", "/tmp/tribeux_cache"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def key_for(url: str, patch_script: str) -> str:
    h = hashlib.sha256()
    h.update((_PIPELINE_VERSION + "\n").encode())
    h.update(((url or "").strip() + "\n").encode())
    h.update((patch_script or "").encode())
    return h.hexdigest()[:24]


def _json_path(key: str) -> Path:
    return _cache_dir() / f"{key}.json"


def _video_path(key: str) -> Path:
    return _cache_dir() / f"{key}.mp4"


def get(key: str) -> Optional[dict[str, Any]]:
    """Return the cached payload {report, logs, checkpoints, video_path} or None.

    The returned `video_path` is the on-disk location of the cached mp4 (or
    None if the cache was written without video). The caller is responsible
    for wiring it into `jobs.store.set_video(job_id, ...)` during replay.
    """
    p = _json_path(key)
    if not p.is_file():
        return None
    try:
        with p.open() as f:
            payload = json.load(f)
    except Exception:  # noqa: BLE001 — cache is best-effort
        return None
    vp = _video_path(key)
    payload["video_path"] = str(vp) if vp.is_file() else None
    return payload


def put(
    key: str,
    *,
    report: Report,
    logs: list[dict[str, Any]],
    checkpoints: list[dict[str, Any]],
    progress_trace: list[dict[str, Any]],
    video_source_path: Optional[str] = None,
) -> None:
    """Persist the Report JSON and, if provided, copy the mp4 to the cache dir.

    The video is copied (not moved) so the live pipeline's tempdir can be
    cleaned up on its usual schedule without leaving the cache dangling.
    """
    try:
        payload = {
            "report": report.model_dump(),
            "logs": logs,
            "checkpoints": checkpoints,
            "progress_trace": progress_trace,
        }
        with _json_path(key).open("w") as f:
            json.dump(payload, f)
    except Exception:  # noqa: BLE001 — never block the demo on cache-write
        pass
    if video_source_path:
        try:
            src = Path(video_source_path)
            if src.is_file():
                shutil.copy2(src, _video_path(key))
        except Exception:  # noqa: BLE001
            pass
