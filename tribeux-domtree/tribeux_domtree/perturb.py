import json
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
import io
from .types import BBox

def generate_mask_scripts(section_selectors: dict[str, list[str]]) -> dict[str, str]:
    """
    Generates JS scripts that can be executed in a Playwright page to apply masks.
    """
    scripts = {}
    for section, selectors in section_selectors.items():
        if not selectors:
            scripts[section] = "() => { console.log('No elements to mask'); }"
            continue
            
        # Join selectors into a single CSS string
        selector_str = ", ".join(selectors)
        
        # Create an immediately-invoked JS function
        # Use json.dumps to handle escaping correctly for JS string literals
        js_code = f"""
        (() => {{
            const selector = {json.dumps(selector_str)};
            document.querySelectorAll(selector).forEach(el => {{
                el.style.setProperty('visibility', 'hidden', 'important');
            }});
        }})();
        """
        scripts[section] = js_code
        
    return scripts

async def generate_html_masks(url: str, section_selectors: dict[str, list[str]], viewport: tuple[int, int] = (1280, 800)) -> dict[str, str]:
    """
    Generates masks by hiding elements via CSS and returning the modified HTML.
    This preserves overlapping elements (Z-index).
    """
    masks = {}
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
        page = await context.new_page()
        
        await page.goto(url, wait_until="networkidle")
        
        # Take full HTML
        masks["full"] = await page.content()
        
        for section, selectors in section_selectors.items():
            if not selectors: continue
            
            # Hide the section using CSS injection
            selector_str = ", ".join(selectors)
            await page.add_style_tag(content=f"{selector_str} {{ visibility: hidden !important; }}")
            
            # Get modified HTML
            masks[section] = await page.content()
            
            # Clear style tag for next mask by reloading or removing
            # Reloading is safer to ensure a clean state
            await page.goto(url, wait_until="networkidle")
            
        await browser.close()
        
    return masks

def generate_masks(screenshot_png: bytes, sections: dict[str, BBox]) -> dict[str, bytes]:
    """
    Generates grey-box masks for each section.
    Returns: {section_name: png_bytes}
    """
    base_img = Image.open(io.BytesIO(screenshot_png))
    masks = {"full": screenshot_png}
    
    for name, bbox in sections.items():
        # Copy original
        mask_img = base_img.copy()
        draw = ImageDraw.Draw(mask_img)
        
        # Draw grey rectangle over the section
        # Using #808080 (mean grey)
        draw.rectangle(
            [bbox.x, bbox.y, bbox.x + bbox.w, bbox.y + bbox.h],
            fill=(128, 128, 128)
        )
        
        # Save to bytes
        img_byte_arr = io.BytesIO()
        mask_img.save(img_byte_arr, format='PNG')
        masks[name] = img_byte_arr.getvalue()
        
    return masks
