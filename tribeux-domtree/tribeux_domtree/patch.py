import asyncio
from playwright.async_api import async_playwright
from .types import AnalysisResult

async def apply_patch(url: str, selector: str, new_html: str, viewport: tuple[int, int] = (1280, 800)) -> bytes:
    """
    Applies HTML patch and returns a fresh screenshot.
    Full AnalysisResult regeneration happens in analyze.py
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
        page = await context.new_page()
        
        await page.goto(url, wait_until="networkidle")
        
        # Apply the patch
        success = await page.evaluate(f"""
            () => {{
                const el = document.querySelector("{selector}");
                if (el) {{
                    el.outerHTML = `{new_html}`;
                    return true;
                }}
                return false;
            }}
        """)
        
        if not success:
            # Try by text if selector fails (fallback)
            pass
            
        # Wait for layout settle
        await asyncio.sleep(0.5)
        
        # Take new screenshot
        screenshot = await page.screenshot(full_page=True)
        await browser.close()
        
        return screenshot

# Note: We will wrap this in a higher-level function in analyze.py
