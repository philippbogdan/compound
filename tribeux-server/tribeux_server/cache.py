"""Disk-backed Report cache for demo mode.

Each `run_pipeline` invocation takes ~1-3 min (TRIBE round-trip dominates).
For repeat demos of the same URL + patch_script, that's dead weight. This
module lets us save the entire Report (plus the logs, checkpoints, and
progress events that narrated the pipeline) so the next run can replay
them fast.

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


def _path(key: str) -> Path:
    return _cache_dir() / f"{key}.json"


def get(key: str) -> Optional[dict[str, Any]]:
    """Return the cached payload {report, logs, checkpoints} or None."""
    p = _path(key)
    if not p.is_file():
        return None
    try:
        with p.open() as f:
            return json.load(f)
    except Exception:  # noqa: BLE001 — cache is best-effort
        return None


def put(
    key: str,
    *,
    report: Report,
    logs: list[dict[str, Any]],
    checkpoints: list[dict[str, Any]],
    progress_trace: list[dict[str, Any]],
) -> None:
    try:
        payload = {
            "report": report.model_dump(),
            "logs": logs,
            "checkpoints": checkpoints,
            "progress_trace": progress_trace,
        }
        with _path(key).open("w") as f:
            json.dump(payload, f)
    except Exception:  # noqa: BLE001 — never block the demo on cache-write
        pass
