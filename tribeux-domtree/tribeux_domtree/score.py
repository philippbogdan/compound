import re

def calculate_importance(node: dict, viewport_w: int, viewport_h: int, page_h: int) -> dict:
    bbox = node['bbox']
    tag = node['tag'].lower()
    text = node['text'].lower()
    
    # 1. Visual Score (0.0 - 1.0)
    # Area relative to viewport
    viewport_area = viewport_w * viewport_h
    area_ratio = min((bbox['w'] * bbox['h']) / (viewport_area * 0.5), 1.0)
    visual_score = area_ratio
    
    # 2. Semantic Score (0.0 - 1.0)
    tag_weights = {
        'h1': 1.0, 'h2': 0.85, 'h3': 0.7,
        'button': 0.95, 'a': 0.6, 'img': 0.65,
        'form': 0.8, 'input': 0.7, 'video': 0.85
    }
    semantic_score = tag_weights.get(tag, 0.2)
    
    # 3. Position Score (0.0 - 1.0)
    # Above fold is better
    is_above_fold = bbox['y'] < viewport_h
    dist_from_top = bbox['y'] / page_h
    position_score = 1.0 if is_above_fold else max(0.4, 1.0 - dist_from_top)
    
    # Center-X bonus
    center_x = bbox['x'] + bbox['w'] / 2
    dist_from_center_x = abs(center_x - viewport_w / 2)
    if dist_from_center_x < viewport_w / 4:
        position_score = min(1.0, position_score * 1.1)
        
    # 4. Text Salience (0.0 - 1.0)
    salience_score = 0.5
    if not text:
        salience_score = 0.0
    else:
        # CTA verbs
        cta_pattern = r'\b(get|start|try|join|book|buy|sign|download|access|claim)\b'
        if re.search(cta_pattern, text):
            salience_score *= 1.4
            
        # ALL CAPS bonus
        if node['text'].isupper() and len(node['text']) > 3:
            salience_score *= 1.1
            
    salience_score = min(1.0, salience_score)
    
    # Combined Score (Weighted Mean)
    combined = (
        visual_score * 0.30 +
        semantic_score * 0.30 +
        position_score * 0.20 +
        salience_score * 0.20
    )
    
    return {
        "visual": round(visual_score, 2),
        "semantic": round(semantic_score, 2),
        "position": round(position_score, 2),
        "text_salience": round(salience_score, 2),
        "combined": round(combined, 2)
    }
