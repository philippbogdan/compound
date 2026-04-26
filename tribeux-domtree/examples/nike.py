import asyncio
import os
from tribeux_domtree.analyze import analyze

async def main():
    url = "https://nike.com"
    print(f"Analyzing {url} (Checking for cookies/overlays)...")
    
    # 1. Full Analysis
    result = await analyze(url)
    
    print(f"Analysis complete. Found {len(result.units)} units.")
    print(f"Sections detected: {list(result.sections.keys())}")
    
    # Save screenshot
    os.makedirs("output/nike", exist_ok=True)
    with open("output/nike/nike_full.png", "wb") as f:
        f.write(result.screenshot_png)
    print("Saved full screenshot (should be clean of cookies) to output/nike/nike_full.png")
    
    # 2. Intelligent Masking (HTML-based)
    print("Generating intelligent perturbation masks (HTML-based)...")
    masks = await result.get_html_masks()
    
    for name, html_content in masks.items():
        with open(f"output/nike/nike_mask_{name}.html", "w") as f:
            f.write(html_content)
    print(f"Saved {len(masks)} HTML masks to output/nike/")
    
    # Identify top unit
    top_unit = result.units[0]
    print(f"Top importance unit: {top_unit.id} ({top_unit.text[:50]}...)")
    
    print("-" * 20)
    print("Line of Code for Agent:")
    print(top_unit.outer_html[:500] + "...")
    print("-" * 20)

if __name__ == "__main__":
    asyncio.run(main())
