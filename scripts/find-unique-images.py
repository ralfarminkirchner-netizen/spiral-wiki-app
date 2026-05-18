#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Find UNIQUE images for all 219 entries currently using generic fallbacks.
Uses Wikipedia API (de + en) to find the actual person's image.
"""
import json, urllib.request, urllib.parse, time, sys, shutil, re

FALLBACK_MARKERS = [
    'David_-_The_Death_of_Socrates', 'Nietzsche187a',
    'GodfreyKneller-IsaacNewton', 'Albert_Einstein_Head',
    'Gandhara_Buddha', 'Mona_Lisa', 'VanGogh-starry'
]

def is_fallback(url):
    return any(m in url for m in FALLBACK_MARKERS)

def wiki_image(title, lang='de'):
    """Get thumbnail URL from Wikipedia API."""
    try:
        api = f'https://{lang}.wikipedia.org/w/api.php'
        params = urllib.parse.urlencode({
            'action': 'query', 'titles': title, 'prop': 'pageimages',
            'format': 'json', 'pithumbsize': 400, 'redirects': '1'
        })
        req = urllib.request.Request(f'{api}?{params}')
        req.add_header('User-Agent', 'SpiralMindWiki/1.0 (ralf@spiral-mind.wiki)')
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())
        pages = result.get('query', {}).get('pages', {})
        for page in pages.values():
            thumb = page.get('thumbnail', {}).get('source', '')
            if thumb and 'upload.wikimedia.org' in thumb:
                return thumb
    except Exception as ex:
        pass
    return None

def extract_image_from_content(content):
    """Extract image URL from monograph markdown content."""
    # Look for ![...](https://upload.wikimedia.org/...) pattern
    m = re.search(r'!\[.*?\]\((https://upload\.wikimedia\.org/[^\s\)]+)', content)
    if m:
        url = m.group(1)
        # Skip SVGs and videos
        if not url.endswith(('.svg', '.ogv', '.webm')):
            return url
    return None

with open('public/data.json') as f:
    data = json.load(f)

# Find entries with fallback images
to_fix = []
for i, e in enumerate(data):
    if is_fallback(e.get('imageUrl', '')):
        to_fix.append(i)

print(f"Entries to fix: {len(to_fix)}")

fixed_content = 0
fixed_api_de = 0
fixed_api_en = 0
still_broken = 0

for count, idx in enumerate(to_fix):
    e = data[idx]
    title = e.get('title', '')
    content = e.get('content', '')
    
    # Strategy 1: Extract from monograph content (most reliable)
    img = extract_image_from_content(content)
    if img and not any(m in img for m in FALLBACK_MARKERS):
        # Verify it's not an SVG or broken pattern
        if 'upload.wikimedia.org' in img:
            data[idx]['imageUrl'] = img
            fixed_content += 1
            continue
    
    # Strategy 2: Wikipedia API (German)
    img = wiki_image(title, 'de')
    if img:
        data[idx]['imageUrl'] = img
        fixed_api_de += 1
        time.sleep(0.1)
        continue
    
    # Strategy 3: Wikipedia API (English)
    img = wiki_image(title, 'en')
    if img:
        data[idx]['imageUrl'] = img
        fixed_api_en += 1
        time.sleep(0.1)
        continue
    
    still_broken += 1
    
    if (count + 1) % 25 == 0:
        print(f"  [{count+1}/{len(to_fix)}] content={fixed_content} de={fixed_api_de} en={fixed_api_en} broken={still_broken}", flush=True)
    
    time.sleep(0.05)

print(f"\nResults: content={fixed_content} api_de={fixed_api_de} api_en={fixed_api_en} still_broken={still_broken}")
print(f"Total fixed: {fixed_content + fixed_api_de + fixed_api_en}/{len(to_fix)}")

# Check remaining fallbacks
remaining = sum(1 for e in data if is_fallback(e.get('imageUrl', '')))
print(f"Remaining fallbacks: {remaining}")

# Save
with open('public/data.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
with open('public/appData.js', 'w') as f:
    f.write('const windowWikiData = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';')
shutil.copy2('public/appData.js', 'dist/appData.js')
print("Saved!")
