import asyncio
import time
from playwright.async_api import async_playwright
import os


_SCROLL_JS = """
async (opts) => {
    const { durationMs, scrollMax } = opts;
    const log = [];
    const start = performance.now();

    return await new Promise((resolve) => {
        function tick() {
            const elapsed = performance.now() - start;
            const progress = Math.min(elapsed / durationMs, 1);
            const targetY = progress * scrollMax;
            // `behavior: instant` bypasses any scroll-behavior: smooth CSS so our
            // frame-synced interpolation drives the actual scroll position.
            window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
            log.push([elapsed / 1000, window.scrollY]);
            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                resolve(log);
            }
        }
        requestAnimationFrame(tick);
    });
}
"""


class URLRecorder:
    def __init__(self, output_dir="recordings", viewport_size={"width": 1280, "height": 1280}):
        self.output_dir = output_dir
        self.viewport_size = viewport_size
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    async def record_scroll(self, url, duration=15, patch_script=None):
        """Record a scroll-through of `url` and return scroll telemetry.

        `patch_script` (optional) is JS evaluated in the page AFTER navigation
        but BEFORE scrolling — used to replay accumulated outerHTML patches
        across iteration passes. Exceptions inside the patch are logged and
        swallowed so one bad patch can't nuke the recording.

        Returns:
            {
              text, video_path, scroll_start_offset,
              scroll_log: [(t_s, scroll_y), ...],    # frame-synced samples
              total_height, viewport_h, actual_duration_s,
            }
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport=self.viewport_size,
                record_video_dir=self.output_dir,
            )

            start_timestamp = time.time()

            page = await context.new_page()
            await page.goto(url, wait_until="networkidle")

            # Apply any previously-proposed patches before scrolling so TRIBE
            # scores the visibly-patched page.
            if patch_script:
                safe_script = (
                    "() => { try {\n"
                    + patch_script
                    + "\n} catch (e) { console.warn('tribeux patch failed', e); } }"
                )
                try:
                    await page.evaluate(safe_script)
                except Exception as exc:
                    # Never fail the recording on a bad patch — just surface it.
                    print(f"[URLRecorder] patch_script evaluate error: {exc!r}")

            total_height = await page.evaluate("document.body.scrollHeight")
            viewport_h = self.viewport_size["height"]
            scroll_max = max(0, total_height - viewport_h)

            scroll_start_offset = time.time() - start_timestamp

            scroll_log: list[list[float]] = []
            duration_ms = int(duration * 1000)
            scroll_t0 = time.time()
            if scroll_max > 0:
                scroll_log = await page.evaluate(
                    _SCROLL_JS,
                    {"durationMs": duration_ms, "scrollMax": scroll_max},
                )
            else:
                await asyncio.sleep(duration)
                scroll_log = [[0.0, 0.0], [float(duration), 0.0]]
            actual_duration_s = time.time() - scroll_t0

            page_text = await page.evaluate("document.body.innerText")

            video_path = await page.video.path()

            await context.close()
            await browser.close()

            return {
                "text": page_text,
                "video_path": video_path,
                "scroll_start_offset": scroll_start_offset,
                "scroll_log": scroll_log,
                "total_height": total_height,
                "viewport_h": viewport_h,
                "actual_duration_s": actual_duration_s,
            }
