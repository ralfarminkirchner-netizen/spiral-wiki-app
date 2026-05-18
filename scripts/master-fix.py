#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MASTER FIX: One-shot comprehensive image repair.
Reads data.json, applies ALL fixes, saves everywhere.
"""
import json, hashlib, re, shutil

# Load
with open('public/data.json') as f:
    data = json.load(f)

# VERIFIED WORKING fallback pools (browser-tested)
POOLS = {
    'Bewusstseinsforschung': ['https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/1b/Nietzsche187a.jpg'],
    'Kunst': ['https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/6/66/VanGogh-starry_night_ballance1.jpg'],
    'Kybernetik': ['https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/2/28/Albert_Einstein_Head_cleaned.jpg'],
    'Neurologie': ['https://upload.wikimedia.org/wikipedia/commons/2/28/Albert_Einstein_Head_cleaned.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg'],
    'Philosophie': ['https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/1b/Nietzsche187a.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/2/28/Albert_Einstein_Head_cleaned.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg'],
    'Physik': ['https://upload.wikimedia.org/wikipedia/commons/2/28/Albert_Einstein_Head_cleaned.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg'],
    'Psychologie': ['https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/1b/Nietzsche187a.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/2/28/Albert_Einstein_Head_cleaned.jpg'],
    'Religion': ['https://upload.wikimedia.org/wikipedia/commons/b/b8/Gandhara_Buddha_%28tnm%29.jpeg',
        'https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg'],
    'Soziologie': ['https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/2/28/Albert_Einstein_Head_cleaned.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/1b/Nietzsche187a.jpg'],
    'Synthesen': ['https://upload.wikimedia.org/wikipedia/commons/1/1b/Nietzsche187a.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg'],
    'Tradition': ['https://upload.wikimedia.org/wikipedia/commons/b/b8/Gandhara_Buddha_%28tnm%29.jpeg',
        'https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/1b/Nietzsche187a.jpg'],
    'Wirtschaft': ['https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg'],
    'Wissenschaft': ['https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/2/28/Albert_Einstein_Head_cleaned.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/1b/Nietzsche187a.jpg'],
}

def fallback(cat, title):
    top = cat.split('/')[0].strip().replace('_',' ')
    pool = POOLS.get('Philosophie')
    for key in POOLS:
        if key.lower() in top.lower() or top.lower() in key.lower():
            pool = POOLS[key]; break
    return pool[int(hashlib.md5(title.encode()).hexdigest(),16) % len(pool)]

def is_bad(url):
    """Check if URL is obviously broken."""
    if not url: return True
    if url.startswith('data:image/svg'): return True
    if url.startswith('/'): return True
    if 'bing.net' in url: return True
    if url.endswith(('.ogv','.webm','.tif','.tiff')): return True
    if 'Special:FilePath' in url: return True
    if '.svg' in url.lower(): return True
    # Check for fabricated filenames (known patterns)
    fname = url.split('/')[-1]
    fab_patterns = [
        '_Concept.', '_Diagram.', '_Portrait.', '_Photo.', '_Image.',
        '_Illustration.', '_Symbol.', '_Theory.', '_Principle.',
        '_Network.', '_System.', '_Process.', '_Structure.',
        '_Book_Cover.', '_Cover.', '_Logo.', '_Model.',
        '_Psychology.', '_Neuroscience.', '_Philosophy.',
    ]
    if any(p in fname for p in fab_patterns): return True
    return False

# Step 1: Extract from content where possible
extracted = 0
for e in data:
    url = e.get('imageUrl','')
    if is_bad(url):
        content = e.get('content','')
        # Look for valid image URLs in content
        all_urls = re.findall(r'(https://upload\.wikimedia\.org/wikipedia/[^\s\)\]\"]+)', content)
        valid = [u for u in all_urls if not u.endswith(('.svg','.ogv','.webm','.tif')) and 'thumb' not in u.split('/')[-1][:5]]
        if valid:
            e['imageUrl'] = valid[0]
            extracted += 1
            continue
        # Use fallback
        e['imageUrl'] = fallback(e.get('category',''), e['title'])

# Step 2: Convert thumb URLs to full-res 
thumb_fixed = 0
for e in data:
    url = e.get('imageUrl','')
    if '/thumb/' in url and 'lossy-page' not in url:
        m = re.match(r'(https://upload\.wikimedia\.org/wikipedia/(?:commons|en)/)thumb/([0-9a-f]/[0-9a-f]{2}/[^/]+)/.*', url)
        if m:
            e['imageUrl'] = m.group(1) + m.group(2)
            thumb_fixed += 1

print(f'Extracted from content: {extracted}')
print(f'Thumb->full: {thumb_fixed}')

# Verify all URLs
bad = sum(1 for e in data if is_bad(e.get('imageUrl','')))
http = sum(1 for e in data if e.get('imageUrl','').startswith('http'))
unique = len(set(e['imageUrl'] for e in data))
print(f'Bad remaining: {bad}, HTTP: {http}, Unique: {unique}')

# Save
with open('public/data.json','w') as f: json.dump(data,f,indent=2,ensure_ascii=False)
with open('public/appData.js','w') as f: f.write('const windowWikiData = '+json.dumps(data,indent=2,ensure_ascii=False)+';')
shutil.copy2('public/appData.js','dist/appData.js')
print('MASTER FIX DONE!')
