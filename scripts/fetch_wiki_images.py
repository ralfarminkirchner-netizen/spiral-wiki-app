import os
import re
import requests
import time
from urllib.parse import quote

LIBRARY_DIR = "/Users/ralfkirchner/spiral-os/knowledge_base/core_library"

def get_wiki_image(title, lang="de"):
    # Strip suffixes like " monographie" or " (monographie)" just in case
    clean_title = re.sub(r'(_monographie| monographie)$', '', title, flags=re.IGNORECASE)
    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{quote(clean_title)}"
    headers = {"User-Agent": "SpiralWikiApp/1.0 (ralf@spiral-os.com)"}
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if "thumbnail" in data:
                return data["thumbnail"]["source"]
            elif "originalimage" in data:
                return data["originalimage"]["source"]
    except Exception as e:
        pass
    return None

def process_files():
    files_to_process = []
    for root, dirs, files in os.walk(LIBRARY_DIR):
        for file in files:
            if file.endswith(".md"):
                files_to_process.append(os.path.join(root, file))

    print(f"Gefundene Markdown-Dateien: {len(files_to_process)}")
    updated = 0
    
    for filepath in files_to_process:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract title from `# Title`
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if not title_match:
            continue
            
        raw_title = title_match.group(1).strip()
        # Clean title
        clean_title = re.sub(r'\[\[|\]\]', '', raw_title)
        clean_title = re.sub(r'\(.*?\)', '', clean_title).strip()
        if ' - ' in clean_title: clean_title = clean_title.split(' - ')[0].strip()
        if ': ' in clean_title: clean_title = clean_title.split(': ')[0].strip()

        # Check if an image already exists right under the title
        # We look for ![...]
        lines = content.split('\n')
        has_image = False
        title_index = -1
        
        for i, line in enumerate(lines):
            if line.startswith('# '):
                title_index = i
            elif title_index != -1 and line.strip().startswith('!['):
                has_image = True
                break
            elif title_index != -1 and i > title_index + 3:
                break # Only check first few lines after title
                
        if not has_image:
            # Fetch image
            image_url = get_wiki_image(clean_title, "de")
            if not image_url:
                image_url = get_wiki_image(clean_title, "en")
                
            if image_url:
                # Insert image
                if title_index != -1:
                    lines.insert(title_index + 1, f"\n![{clean_title}]({image_url})\n")
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write('\n'.join(lines))
                    updated += 1
                    print(f"✅ Bild gefunden für: {clean_title}")
                    time.sleep(0.05) # Rate limiting
            else:
                pass
                # print(f"❌ Kein Bild gefunden für: {clean_title}")

    print(f"\nFertig! {updated} Dateien wurden mit Bildern aktualisiert.")

if __name__ == "__main__":
    process_files()
