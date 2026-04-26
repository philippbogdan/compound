import asyncio
import os
from tribeux_domtree.analyze import analyze

async def main():
    url = "https://airbnb.com"
    print(f"Analyzing {url}...")
    
    # 1. Full Analysis
    result = await analyze(url)
    
    print(f"Analysis complete. Found {len(result.units)} units.")
    print(f"Sections detected: {list(result.sections.keys())}")
    
    # Save screenshot
    os.makedirs("output", exist_ok=True)
    with open("output/airbnb_full.png", "wb") as f:
        f.write(result.screenshot_png)
    print("Saved full screenshot to output/airbnb_full.png")
    
    # 2. Intelligent Masking (DOM-aware)
    print("Generating intelligent perturbation masks (DOM-aware)...")
    # This respects Z-index: overlapping navs/popups stay visible!
    masks = await result.get_perturbation_masks()
    
    for name, mask_png in masks.items():
        with open(f"output/airbnb_mask_{name}.png", "wb") as f:
            f.write(mask_png)
    print(f"Saved {len(masks)} masks to output/")
    
    # Identify top unit
    top_unit = result.units[0]
    print(f"Top importance unit: {top_unit.id} ({top_unit.text[:50]}...)")
    
    print("-" * 20)
    print("Line of Code for Agent:")
    print(top_unit.outer_html[:500] + "...")
    print("-" * 20)

if __name__ == "__main__":
    asyncio.run(main())
