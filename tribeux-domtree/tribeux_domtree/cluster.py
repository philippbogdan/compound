from .types import BBox

def assign_sections(candidates: list[dict], page_height: int) -> tuple[list[dict], dict[str, BBox], dict[str, list[str]]]:
    """
    Assigns each candidate to a section.
    Returns: (updated_candidates, section_bounds, section_selectors)
    """
    section_bounds = {
        "nav": {"min_y": page_height, "max_y": 0, "min_x": 10000, "max_x": 0},
        "hero": {"min_y": page_height, "max_y": 0, "min_x": 10000, "max_x": 0},
        "features": {"min_y": page_height, "max_y": 0, "min_x": 10000, "max_x": 0},
        "cta": {"min_y": page_height, "max_y": 0, "min_x": 10000, "max_x": 0},
        "footer": {"min_y": page_height, "max_y": 0, "min_x": 10000, "max_x": 0},
    }
    
    section_selectors = {k: [] for k in section_bounds.keys()}
    
    updated_candidates = []
    for cand in candidates:
        cy = cand['bbox']['y'] + cand['bbox']['h'] // 2
        ratio = cy / page_height
        
        if ratio < 0.10: section = "nav"
        elif ratio < 0.35: section = "hero"
        elif ratio < 0.65: section = "features"
        elif ratio < 0.80: section = "cta"
        else: section = "footer"
        
        cand['section'] = section
        updated_candidates.append(cand)
        section_selectors[section].append(cand['selector'])
        
        # Update bounds
        b = cand['bbox']
        section_bounds[section]["min_y"] = min(section_bounds[section]["min_y"], b['y'])
        section_bounds[section]["max_y"] = max(section_bounds[section]["max_y"], b['y'] + b['h'])
        section_bounds[section]["min_x"] = min(section_bounds[section]["min_x"], b['x'])
        section_bounds[section]["max_x"] = max(section_bounds[section]["max_x"], b['x'] + b['w'])
        
    # Convert to BBox objects
    final_bounds = {}
    for name, bounds in section_bounds.items():
        if bounds["max_y"] > bounds["min_y"]:
            final_bounds[name] = BBox(
                x=max(0, bounds["min_x"]),
                y=max(0, bounds["min_y"]),
                w=bounds["max_x"] - bounds["min_x"],
                h=bounds["max_y"] - bounds["min_y"]
            )
            
    return updated_candidates, final_bounds, section_selectors
