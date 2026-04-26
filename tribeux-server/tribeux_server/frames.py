"""Frame capture.

Two modes:

- **Sample mode** (default): synthesise N placeholder frames from the
  sample screenshot bundled with the repo so the rest of the pipeline
  works without a live network call. Each "frame" is the same image
  with a different time stamp baked into the data URL metadata.

- **Live mode** (`use_real_render=True`): scroll the page in
  Playwright, take one screenshot per second, downsample to 256x256,
  and return as base64-encoded PNGs. This is the path Claude actually
  consumes when the API key is present and the box has Playwright
  browsers installed.

Both paths produce `Frame` objects whose `t` indexes line up with the
inference time-series arrays.
"""
from __future__ import annotations

import asyncio
import base64
import io
from pathlib import Path

from PIL import Image

from .schemas import Frame

_SAMPLE_PNG = Path(__file__).resolve().parent.parent.parent / "tribeux" / "app" / "public" / "airbnb-landing.png"
_FRAME_SIZE = 256


def _png_to_data_url(png_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")


def _resize_to_square(png_bytes: bytes, size: int = _FRAME_SIZE) -> bytes:
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    # Crop a top-aligned square (the hero is what matters for landing pages).
    w, h = img.size
    side = min(w, h)
    left = max(0, (w - side) // 2)
    img = img.crop((left, 0, left + side, side))
    img = img.resize((size, size), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def _sample_frames(n: int) -> list[Frame]:
    if not _SAMPLE_PNG.exists():
        # Fallback: emit a flat grey frame so the pipeline still works in CI.
        img = Image.new("RGB", (_FRAME_SIZE, _FRAME_SIZE), (224, 226, 230))
        out = io.BytesIO()
        img.save(out, format="PNG", optimize=True)
        png = out.getvalue()
    else:
        png = _resize_to_square(_SAMPLE_PNG.read_bytes())
    data_url = _png_to_data_url(png)
    return [
        Frame(t=i, seconds=float(i), data_url=data_url, width=_FRAME_SIZE, height=_FRAME_SIZE)
        for i in range(n)
    ]


async def capture_frames(
    url: str,
    *,
    n_timesteps: int = 13,
    use_real_render: bool = False,
    viewport: tuple[int, int] = (1280, 800),
) -> tuple[list[Frame], bytes | None]:
    """Capture (frames, full_page_screenshot_png).

    Returns a list of `n_timesteps` frames plus the full-page screenshot
    used to build them (or `None` in pure-sample mode).
    """
    if not use_real_render:
        return _sample_frames(n_timesteps), None

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            ctx = await browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
            page = await ctx.new_page()
            await page.goto(url, wait_until="networkidle", timeout=60_000)

            # Strip cookie banners — same heuristic tribedomtree uses.
            await page.evaluate(
                """
                () => {
                    const kw = ['cookie', 'consent', 'privacy', 'banner', 'gdpr'];
                    const sel = ['[id*="cookie" i]', '[class*="cookie" i]',
                                 '[id*="consent" i]', '[class*="consent" i]',
                                 '[role="dialog"]', '[role="alertdialog"]'];
                    document.querySelectorAll(sel.join(',')).forEach(el => {
                        const t = (el.innerText || '').toLowerCase();
                        if (kw.some(k => t.includes(k))) el.remove();
                    });
                }
                """
            )

            full_page_png = await page.screenshot(full_page=True)
            page_height = await page.evaluate("document.body.scrollHeight")
            view_h = viewport[1]
            scroll_max = max(0, page_height - view_h)
            frames: list[Frame] = []
            for i in range(n_timesteps):
                ratio = i / max(1, n_timesteps - 1)
                y = int(ratio * scroll_max)
                await page.evaluate(f"window.scrollTo(0, {y})")
                await asyncio.sleep(0.25)
                shot = await page.screenshot(full_page=False)
                small = _resize_to_square(shot)
                frames.append(
                    Frame(
                        t=i,
                        seconds=float(i),
                        data_url=_png_to_data_url(small),
                        width=_FRAME_SIZE,
                        height=_FRAME_SIZE,
                    )
                )
            return frames, full_page_png
        finally:
            await browser.close()
