"""URL → 256x256 mp4 via the local urltovideo package.

Wraps `URLRecorder` + `VideoEditor` from the sibling `urltovideo`
package (no pyproject — added to sys.path on import). Returns the final
mp4 path along with the page text and 13 evenly-spaced PNG frames
(extracted via ffmpeg) for the Claude prompt and report rendering.
"""
from __future__ import annotations

import asyncio
import base64
import io
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

from .schemas import Frame

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_URLTOVIDEO_DIR = _REPO_ROOT / "urltovideo"
if str(_URLTOVIDEO_DIR) not in sys.path:
    sys.path.insert(0, str(_URLTOVIDEO_DIR))

from url_to_video import URLRecorder, VideoEditor  # noqa: E402

_FRAME_SIZE = 256
_N_TIMESTEPS = 13


def _png_to_data_url(png_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")


def _extract_frames(mp4_path: Path, n: int = _N_TIMESTEPS) -> list[Frame]:
    """Pull n evenly-spaced PNG frames from the mp4 for Claude/UI use."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(mp4_path)],
        capture_output=True, text=True, check=True,
    )
    duration = float(out.stdout.strip() or "13")
    frames: list[Frame] = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for i in range(n):
            t = (i / max(1, n - 1)) * max(0.0, duration - 0.05)
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


async def _full_screenshot(url: str, patch_script: str | None = None) -> bytes | None:
    """Grab a single full-page PNG for the report's before image."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
                page = await ctx.new_page()
                await page.goto(url, wait_until="networkidle", timeout=60_000)
                if patch_script:
                    safe = (
                        "() => { try {\n"
                        + patch_script
                        + "\n} catch (e) { console.warn('tribeux patch failed', e); } }"
                    )
                    try:
                        await page.evaluate(safe)
                    except Exception:  # noqa: BLE001
                        pass
                return await page.screenshot(full_page=True)
            finally:
                await browser.close()
    except Exception:  # noqa: BLE001
        return None


async def render_url(url: str, *, duration: int = 15, patch_script: str | None = None) -> dict:
    """URL → {video_path, page_text, frames, full_page_png, scroll_log, total_height, ...}.

    `patch_script` is optional JS replayed after navigation and before scroll —
    used by the iterative orchestrator to stack outerHTML patches across passes.
    """
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
        "scroll_log": rec.get("scroll_log") or [],
        "total_height": rec.get("total_height", 0),
        "viewport_h": rec.get("viewport_h", 1024),
        "actual_duration_s": rec.get("actual_duration_s", float(duration)),
    }
