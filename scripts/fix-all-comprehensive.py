#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive image fixer: queries Wikipedia API for EVERY entry,
gets real image URLs, and replaces ALL broken ones.
"""
import json, urllib.request, urllib.parse, urllib.error, hashlib, time, sys

FALLBACKS = {
    'Philosophie': ['https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg','https://upload.wikimedia.org/wikipedia/commons/9/99/Sanzio_01.jpg','https://upload.wikimedia.org/wikipedia/commons/6/6a/Immanuel_Kant_%28painted_portrait%29.jpg','https://upload.wikimedia.org/wikipedia/commons/1/1b/Nietzsche187a.jpg'],
    'Wissenschaft': ['https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg','https://upload.wikimedia.org/wikipedia/commons/2/28/Albert_Einstein_Head_cleaned.jpg','https://upload.wikimedia.org/wikipedia/commons/1/10/Hubble_ultra_deep_field.jpg'],
    'Psychologie': ['https://upload.wikimedia.org/wikipedia/commons/6/6e/Rorschach_blot_01.jpg','https://upload.wikimedia.org/wikipedia/commons/a/aa/Rorschach_blot_03.jpg','https://upload.wikimedia.org/wikipedia/commons/9/9b/Rorschach_blot_04.jpg'],
    'Soziologie': ['https://upload.wikimedia.org/wikipedia/commons/e/e0/New_York_Stock_Exchange_1908.jpg','https://upload.wikimedia.org/wikipedia/commons/a/af/All_Giza_Pyramids.jpg'],
    'Tradition': ['https://upload.wikimedia.org/wikipedia/commons/7/74/The_Creation_of_Adam.jpg','https://upload.wikimedia.org/wikipedia/commons/0/03/Albrecht_D%C3%BCrer_-_Praying_Hands%2C_1508_-_Google_Art_Project.jpg'],
    'Religion': ['https://upload.wikimedia.org/wikipedia/commons/7/74/The_Creation_of_Adam.jpg','https://upload.wikimedia.org/wikipedia/commons/4/48/Laozi_002.jpg','https://upload.wikimedia.org/wikipedia/commons/b/b8/Gandhara_Buddha_%28tnm%29.jpeg'],
    'Kunst': ['https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg','https://upload.wikimedia.org/wikipedia/commons/6/66/VanGogh-starry_night_ballance1.jpg'],
    'Neurologie': ['https://upload.wikimedia.org/wikipedia/commons/a/a0/Cajal_cortex_drawings.png'],
    'Wirtschaft': ['https://upload.wikimedia.org/wikipedia/commons/e/e0/New_York_Stock_Exchange_1908.jpg'],
    'Bewusstseinsforschung': ['https://upload.wikimedia.org/wikipedia/commons/f/f1/Flammarion.jpg'],
    'Kybernetik': ['https://upload.wikimedia.org/wikipedia/commons/f/f1/Flammarion.jpg'],
    'Physik': ['https://upload.wikimedia.org/wikipedia/commons/2/28/Albert_Einstein_Head_cleaned.jpg'],
    'Synthesen': ['https://upload.wikimedia.org/wikipedia/commons/f/f1/Flammarion.jpg'],
}

def get_fallback(cat, title):
    top = cat.split('/')[0].strip().replace('_', ' ')
    pool = FALLBACKS.get('Philosophie')
    for key in FALLBACKS:
        if key in top or top in key:
            pool = FALLBACKS[key]
            break
    return pool[int(hashlib.md5(title.encode()).hexdigest(), 16) % len(pool)]

def wiki_image(title, lang='de'):
    """Get image URL from Wikipedia API."""
    try:
        api = f'https://{lang}.wikipedia.org/w/api.php'
        params = urllib.parse.urlencode({
            'action': 'query', 'titles': title, 'prop': 'pageimages',
            'format': 'json', 'pithumbsize': 400, 'redirects': '1'
        })
        req = urllib.request.Request(f'{api}?{params}')
        req.add_header('User-Agent', 'SpiralMindWiki/1.0 (contact@example.com)')
        resp = urllib.request.urlopen(req, timeout=8)
        result = json.loads(resp.read())
        pages = result.get('query', {}).get('pages', {})
        for page in pages.values():
            thumb = page.get('thumbnail', {}).get('source', '')
            if thumb and 'upload.wikimedia.org' in thumb:
                return thumb
    except Exception:
        pass
    return None

def verify_url(url):
    """Verify URL loads as an image via GET with range header."""
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'SpiralMindWiki/1.0')
        req.add_header('Range', 'bytes=0-1023')
        resp = urllib.request.urlopen(req, timeout=8)
        ct = resp.headers.get('Content-Type', '')
        return 'image' in ct or resp.status in (200, 206)
    except Exception:
        return False

with open('public/data.json') as f:
    data = json.load(f)

total = len(data)
fixed_api = 0
fixed_fallback = 0
verified_ok = 0
failed_verify = 0

for i, e in enumerate(data):
    url = e.get('imageUrl', '')
    title = e.get('title', '')
    cat = e.get('category', '')

    # Step 1: Check if current URL is obviously broken
    obviously_broken = (
        not url or
        url.startswith('data:image/svg') or
        url.startswith('/') or
        'bing.net' in url or
        url.endswith(('.ogv', '.webm', '.tif', '.tiff')) or
        'Special:FilePath' in url
    )

    if obviously_broken:
        # Try Wikipedia API
        img = wiki_image(title, 'de') or wiki_image(title, 'en')
        if img:
            e['imageUrl'] = img
            fixed_api += 1
        else:
            e['imageUrl'] = get_fallback(cat, title)
            fixed_fallback += 1
    else:
        # Verify the URL actually works
        if not verify_url(url):
            failed_verify += 1
            # Try Wikipedia API first
            img = wiki_image(title, 'de') or wiki_image(title, 'en')
            if img:
                e['imageUrl'] = img
                fixed_api += 1
            else:
                e['imageUrl'] = get_fallback(cat, title)
                fixed_fallback += 1
        else:
            verified_ok += 1

    if (i + 1) % 25 == 0:
        print(f"  [{i+1}/{total}] ok={verified_ok} api={fixed_api} fb={fixed_fallback} fail_verify={failed_verify}", flush=True)
    
    time.sleep(0.05)  # Rate limit

print(f"\nDONE: verified_ok={verified_ok}, fixed_api={fixed_api}, fixed_fallback={fixed_fallback}")
print(f"Total entries: {total}")

with open('public/data.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
with open('public/appData.js', 'w') as f:
    f.write('const windowWikiData = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';')

import shutil
shutil.copy2('public/appData.js', 'dist/appData.js')
print("Saved to public/data.json, public/appData.js, dist/appData.js")
