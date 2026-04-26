from dataclasses import dataclass, field
from typing import Optional, Dict

@dataclass
class BBox:
    x: int
    y: int
    w: int
    h: int

    @property
    def area(self) -> int:
        return self.w * self.h

    @property
    def cx(self) -> int:
        return self.x + self.w // 2

    @property
    def cy(self) -> int:
        return self.y + self.h // 2

@dataclass
class Unit:
    id: str                          # Stable ID: "hero.cta_1"
    section: str                     # nav | hero | features | cta | footer
    tag: str                         # e.g., "BUTTON"
    selector: str                    # UNIQUE CSS selector for Playwright patching
    xpath: str                       # Fallback selector
    bbox: BBox                       # Exact coordinates in screenshot space
    text: str                        # Inner text
    outer_html: str                  # The "Line of Code"
    computed_style: dict             # Key styles
    importance: dict                 # {combined, visual, semantic, etc.}
    parent_id: Optional[str] = None

@dataclass
class AnalysisResult:
    url: str
    screenshot_png: bytes            # Full-page screenshot
    units: list[Unit]
    sections: Dict[str, BBox]        # Bounding boxes of the 5 main sections
    section_selectors: Dict[str, list[str]] # SELECTORS for each section
    
    def get_unit(self, unit_id: str) -> Optional[Unit]:
        for u in self.units:
            if u.id == unit_id:
                return u
        return None

    async def get_html_masks(self) -> Dict[str, str]:
        from .perturb import generate_html_masks
        return await generate_html_masks(self.url, self.section_selectors)

    def get_mask_scripts(self) -> Dict[str, str]:
        from .perturb import generate_mask_scripts
        return generate_mask_scripts(self.section_selectors)
