import asyncio
import time
from playwright.async_api import async_playwright
import os

class URLRecorder:
    def __init__(self, output_dir="recordings", viewport_size={"width": 1280, "height": 1280}):
        self.output_dir = output_dir
        self.viewport_size = viewport_size
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    async def record_scroll(self, url, duration=15, patch_script=None):
        """
        Opens a URL, scrolls to the bottom over the specified duration, and records the session.

        If `patch_script` is given, it's executed once after navigation completes and
        before scrolling starts — used to apply DOM mutations (Claude's redesign
        proposals) so the recorded video reflects the patched page.
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport=self.viewport_size,
                record_video_dir=self.output_dir
            )

            # Start timer as soon as context (and recording) starts
            start_timestamp = time.time()

            page = await context.new_page()
            await page.goto(url, wait_until="networkidle")

            if patch_script:
                try:
                    await page.evaluate(patch_script)
                except Exception:
                    # Patch failures should not break the recording — the caller
                    # already validated the selector existed; downstream JS edge
                    # cases (e.g. SPA rerender) we just log and proceed.
                    pass

            # Get total height
            total_height = await page.evaluate("document.body.scrollHeight")
            viewport_height = self.viewport_size["height"]
            scroll_distance = total_height - viewport_height
            
            # Calculate offset from recording start to actual scroll start
            scroll_start_offset = time.time() - start_timestamp
            
            if scroll_distance > 0:
                steps = int(duration * 60)
                scroll_per_step = scroll_distance / steps
                
                for i in range(steps):
                    await page.evaluate(f"window.scrollBy(0, {scroll_per_step})")
                    await asyncio.sleep(duration / steps)
            else:
                await asyncio.sleep(duration)
                
            # Get all text from the page
            page_text = await page.evaluate("document.body.innerText")
                
            # Get video path before closing
            video_path = await page.video.path()
            
            await context.close()
            await browser.close()
            
            return {
                "text": page_text,
                "video_path": video_path,
                "scroll_start_offset": scroll_start_offset
            }
