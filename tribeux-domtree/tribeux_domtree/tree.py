from .types import Unit, BBox

def build_units(candidates: list[dict]) -> list[Unit]:
    """
    Converts raw candidates into Unit objects with stable IDs.
    IDs format: section.type_index (e.g., hero.cta_1, features.card_2)
    """
    section_counts = {}
    units = []
    
    # Sort by importance.combined desc
    sorted_candidates = sorted(candidates, key=lambda x: x['importance']['combined'], reverse=True)
    
    for cand in sorted_candidates:
        section = cand['section']
        tag = cand['tag'].lower()
        
        # Determine a friendly type name
        if tag in ['h1', 'h2', 'h3']: type_name = "heading"
        elif tag in ['button'] or cand['importance']['semantic'] > 0.8: type_name = "cta"
        elif tag in ['img', 'video', 'svg']: type_name = "media"
        elif tag in ['p', 'span']: type_name = "text"
        else: type_name = "element"
        
        # Generate stable ID
        key = f"{section}.{type_name}"
        section_counts[key] = section_counts.get(key, 0) + 1
        unit_id = f"{key}_{section_counts[key]}"
        
        units.append(Unit(
            id=unit_id,
            section=section,
            tag=cand['tag'],
            selector=cand['selector'],
            xpath=cand['xpath'],
            bbox=BBox(**cand['bbox']),
            text=cand['text'],
            outer_html=cand['outer_html'],
            computed_style=cand['styles'],
            importance=cand['importance']
        ))
        
    return units
