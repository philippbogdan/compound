def extract_candidates(dom_dump: list[dict], page_height: int) -> list[dict]:
    candidates = []
    for node in dom_dump:
        bbox = node['bbox']
        
        # 1. Filter by size
        if bbox['w'] * bbox['h'] < 200:
            continue
            
        # 2. Filter out-of-bounds (extra safety)
        if bbox['y'] > page_height or (bbox['y'] + bbox['h']) < 0:
            continue
            
        # 3. Filter structural containers with no unique content
        # If it has no text and no background/border, it's likely just a wrapper
        has_text = len(node['text'].strip()) > 0
        has_bg = node['styles']['backgroundColor'] != 'rgba(0, 0, 0, 0)' and node['styles']['backgroundColor'] != 'transparent'
        
        if not has_text and not has_bg:
            # We still keep it if it's a major tag like IMG or VIDEO
            if node['tag'] not in ['IMG', 'VIDEO', 'SVG', 'INPUT', 'FORM']:
                continue
                
        candidates.append(node)
        
    # 4. Filter redundant hierarchy (keep the most specific node)
    # If a child has the same bbox as its parent, the parent is often just a wrapper
    # This is a bit complex to do without a full tree, but we can do a proximity check
    
    unique_candidates = []
    # Sort by area ascending so we see children before parents
    sorted_candidates = sorted(candidates, key=lambda x: x['bbox']['w'] * x['bbox']['h'])
    
    seen_bboxes = set()
    for cand in sorted_candidates:
        b = cand['bbox']
        # Create a key that allows for 1px tolerance
        bbox_key = (b['x'] // 2, b['y'] // 2, b['w'] // 2, b['h'] // 2)
        
        if bbox_key in seen_bboxes:
            continue
            
        seen_bboxes.add(bbox_key)
        unique_candidates.append(cand)
        
    return unique_candidates
