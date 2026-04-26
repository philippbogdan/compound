import asyncio
import os
from tribeux_domtree.analyze import analyze
from playwright.async_api import async_playwright

async def main():
    url = "https://nike.com"
    print(f"Analyzing {url}...")
    
    # 1. Analyze page to get selectors
    result = await analyze(url)
    scripts = result.get_mask_scripts()
    
    footer_script = scripts.get("footer")
    if not footer_script:
        print("Error: No footer detected to mask.")
        return

    print("DEBUG: Footer script content:")
    print(footer_script)

    print("Footer mask script generated. Opening live browser to test...")

    # 2. Open live browser and apply the JS script
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Show the browser!
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto(url, wait_until="networkidle")
        
        print("Browser open. Waiting 3 seconds before applying mask...")
        await asyncio.sleep(3)

        # Save Before
        os.makedirs("output/nike_test", exist_ok=True)
        await page.screenshot(path="output/nike_test/1_before_footer_hidden.png", full_page=True)
        print("Saved 'Before' screenshot.")

        # Execute the Footer Mask Script
        print("Applying footer mask via JS...")
        await page.evaluate(footer_script)
        
        print("Mask applied! Browser will stay open until you close it manually...")
        
        # Keep the connection alive until the browser is closed
        try:
            # Wait for the browser to be closed by the user
            while True:
                if browser.is_connected():
                    await asyncio.sleep(1)
                else:
                    break
        except Exception:
            pass

        print("Browser closed.")

if __name__ == "__main__":
    asyncio.run(main())
