import asyncio
import json
from dataclasses import dataclass
from playwright.async_api import async_playwright
from .types import BBox

@dataclass
class RenderArtifacts:
    screenshot_png: bytes
    dom_dump: list[dict]
    html: str
    page_height: int
    viewport: tuple[int, int]

async def render(url: str, viewport: tuple[int, int] = (1280, 800)) -> RenderArtifacts:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
        page = await context.new_page()
        
        await page.goto(url, wait_until="networkidle")
        
        # Remove Cookie Popups and Overlays
        await page.evaluate("""
            () => {
                const cookieKeywords = ['cookie', 'consent', 'privacy', 'banner', 'gdpr', 'onetrust', 'trustarc'];
                const selectors = [
                    '[id*="cookie" i]', '[class*="cookie" i]', 
                    '[id*="consent" i]', '[class*="consent" i]',
                    '[role="dialog"]', '[role="alertdialog"]'
                ];
                
                // 1. Remove by selector matches
                document.querySelectorAll(selectors.join(',')).forEach(el => {
                    const text = el.innerText.toLowerCase();
                    if (cookieKeywords.some(kw => text.includes(kw))) {
                        el.remove();
                    }
                });
                
                // 2. Clear fixed/absolute overlays that cover the screen
                document.querySelectorAll('*').forEach(el => {
                    const style = window.getComputedStyle(el);
                    if ((style.position === 'fixed' || style.position === 'absolute') && 
                        parseInt(style.zIndex) > 1000) {
                        el.remove();
                    }
                });
                
                // 3. Reset overflow hidden on body (often set by modals)
                document.body.style.overflow = 'visible';
                document.documentElement.style.overflow = 'visible';
            }
        """)

        # Scroll to trigger lazy loading
        await page.evaluate("""
            async () => {
                const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
                for (let i = 0; i < document.body.scrollHeight; i += 800) {
                    window.scrollTo(0, i);
                    await delay(100);
                }
                window.scrollTo(0, 0);
                await delay(200);
            }
        """)
        
        # Take full-page screenshot
        screenshot = await page.screenshot(full_page=True)
        
        # Extract DOM data
        # JS script to get all visible elements with their bboxes and styles
        dom_data_json = await page.evaluate("""
            () => {
                const getSelector = (el) => {
                    if (el.id) return `#${CSS.escape(el.id)}`;
                    let path = [];
                    while (el && el.nodeType === Node.ELEMENT_NODE) {
                        let selector = el.nodeName.toLowerCase();
                        if (el.id) {
                            selector += `#${CSS.escape(el.id)}`;
                            path.unshift(selector);
                            break;
                        } else {
                            let sib = el, nth = 1;
                            while (sib = sib.previousElementSibling) {
                                if (sib.nodeName.toLowerCase() == selector) nth++;
                            }
                            if (nth != 1) selector += `:nth-of-type(${nth})`;
                        }
                        path.unshift(selector);
                        el = el.parentNode;
                    }
                    return path.join(' > ');
                };

                const getXPath = (el) => {
                    if (el.id && el.id !== '') return `id("${el.id}")`;
                    if (el === document.body) return el.tagName;
                    let ix = 0;
                    let siblings = el.parentNode ? el.parentNode.childNodes : [];
                    for (let i = 0; i < siblings.length; i++) {
                        let sibling = siblings[i];
                        if (sibling === el) return getXPath(el.parentNode) + '/' + el.tagName + '[' + (ix + 1) + ']';
                        if (sibling.nodeType === 1 && sibling.tagName === el.tagName) ix++;
                    }
                    return '';
                };

                const elements = document.querySelectorAll('*');
                const result = [];
                for (const el of elements) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) continue;
                    
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

                    result.push({
                        tag: el.tagName,
                        selector: getSelector(el),
                        xpath: getXPath(el),
                        bbox: {
                            x: Math.round(rect.left + window.scrollX),
                            y: Math.round(rect.top + window.scrollY),
                            w: Math.round(rect.width),
                            h: Math.round(rect.height)
                        },
                        text: el.innerText ? el.innerText.substring(0, 200) : "",
                        outer_html: el.outerHTML.substring(0, 8192),
                        styles: {
                            color: style.color,
                            backgroundColor: style.backgroundColor,
                            fontSize: style.fontSize,
                            fontWeight: style.fontWeight,
                            padding: style.padding,
                            zIndex: style.zIndex
                        }
                    });
                }
                return result;
            }
        """)

        page_height = await page.evaluate("document.body.scrollHeight")
        html = await page.content()
        
        await browser.close()
        
        return RenderArtifacts(
            screenshot_png=screenshot,
            dom_dump=dom_data_json,
            html=html,
            page_height=page_height,
            viewport=viewport
        )
