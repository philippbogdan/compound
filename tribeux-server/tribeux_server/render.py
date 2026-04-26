"""URL → 256x256 mp4 via the local urltovideo package.

Wraps `URLRecorder` + `VideoEditor` from the sibling `urltovideo`
package (no pyproject — added to sys.path on import). Returns the final
mp4 path along with the page text and 10 evenly-spaced PNG frames
(one per second, ffmpeg-extracted) for the Claude prompt and report
rendering.
"""
from __future__ import annotations

import asyncio
import base64
import subprocess
import sys
import tempfile
from pathlib import Path

from .schemas import Frame

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_URLTOVIDEO_DIR = _REPO_ROOT / "urltovideo"
if str(_URLTOVIDEO_DIR) not in sys.path:
    sys.path.insert(0, str(_URLTOVIDEO_DIR))

# Imported lazily inside `render_url` so a missing urltovideo package
# raises at the call site (where the orchestrator can degrade), not at
# server import time.

# 10s @ 1 frame/sec — aligns with TRIBE inference's per-second
# time-series and Claude's frame_at_<t>s captioning convention.
_DURATION_S = 10
_N_TIMESTEPS = 10
_FRAME_SIZE = 256


def _png_to_data_url(png_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")


def _extract_frames(mp4_path: Path, n: int = _N_TIMESTEPS) -> list[Frame]:
    """Pull n evenly-spaced PNG frames from the mp4 for Claude/UI use.

    Frames land at integer seconds 0..n-1 so `frame_at_<t>s` captioning
    aligns with the inference `time_series_*` arrays (also 1Hz).
    """
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(mp4_path)],
        capture_output=True, text=True, check=True,
    )
    duration = float(out.stdout.strip() or str(_DURATION_S))
    frames: list[Frame] = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for i in range(n):
            t = min(float(i), max(0.0, duration - 0.05))
            png = tmp_path / f"f_{i:03d}.png"
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.3f}",
                 "-i", str(mp4_path), "-frames:v", "1",
                 "-vf", f"scale={_FRAME_SIZE}:{_FRAME_SIZE}",
                 str(png)],
                check=True,
            )
            png_bytes = png.read_bytes()
            frames.append(Frame(
                t=i, seconds=float(t),
                data_url=_png_to_data_url(png_bytes),
                width=_FRAME_SIZE, height=_FRAME_SIZE,
            ))
    return frames


async def _full_screenshot(url: str, *, patch_script: str | None = None) -> bytes | None:
    """Grab a single full-page PNG. Used as a static fallback when the
    recorded video isn't enough (or when callers want a still image of
    the patched page for the Report's before/after diff)."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
                page = await ctx.new_page()
                await page.goto(url, wait_until="networkidle", timeout=60_000)
                if patch_script:
                    try:
                        await page.evaluate(patch_script)
                    except Exception:
                        pass
                return await page.screenshot(full_page=True)
            finally:
                await browser.close()
    except Exception:  # noqa: BLE001
        return None


async def render_url(
    url: str,
    *,
    duration: int = _DURATION_S,
    patch_script: str | None = None,
) -> dict:
    """URL → {video_path, page_text, frames, full_page_png}.

    Raises ImportError if the local `urltovideo` package isn't on disk
    so the orchestrator can degrade to sample mode visibly. The caller
    is responsible for catching and falling back.
    """
    from url_to_video import URLRecorder, VideoEditor  # noqa: E402

    work_dir = Path(tempfile.mkdtemp(prefix="tribeux_render_"))
    raw_dir = work_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    final_path = work_dir / "scroll.mp4"

    recorder = URLRecorder(
        output_dir=str(raw_dir),
        viewport_size={"width": 1024, "height": 1024},
    )
    rec = await recorder.record_scroll(url, duration=duration, patch_script=patch_script)

    editor = VideoEditor(target_size=(_FRAME_SIZE, _FRAME_SIZE), target_fps=30)
    await asyncio.to_thread(
        editor.process_video,
        rec["video_path"], str(final_path), rec.get("scroll_start_offset", 0),
    )

    frames = await asyncio.to_thread(_extract_frames, final_path, _N_TIMESTEPS)
    full_page_png = await _full_screenshot(url, patch_script=patch_script)

    return {
        "video_path": str(final_path),
        "page_text": rec.get("text", "") or "",
        "frames": frames,
        "full_page_png": full_page_png,
    }


def video_to_data_url(video_path: str | Path) -> str:
    """Read an mp4 off disk and return a `data:video/mp4;base64,…` URL.

    The Report embeds patched videos inline so the frontend doesn't
    need a static file route for /tmp/. Files are already small (10s @
    256² @ 30fps ≈ 100–400 KB) so base64 inflation is acceptable.
    """
    data = Path(video_path).read_bytes()
    return "data:video/mp4;base64," + base64.b64encode(data).decode("ascii")
