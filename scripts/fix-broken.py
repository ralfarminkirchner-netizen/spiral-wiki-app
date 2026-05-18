import os
import re
import urllib.request
import urllib.parse
import json
import time

KNOWLEDGE_BASE_DIR = "/Users/ralfkirchner/spiral-os/knowledge_base/core_library"

def get_wikipedia_image(title):
    # Try fetching from German Wikipedia first
    url = f"https://de.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles={urllib.parse.quote(title)}&redirects=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            pages = data.get('query', {}).get('pages', {})
            for page_id, page_data in pages.items():
                if 'original' in page_data and 'source' in page_data['original']:
                    return page_data['original']['source']
    except Exception as e:
        print(f"  [WARN] Fehler bei de.wikipedia für '{title}': {e}")
    
    # Fallback: English Wikipedia
    url_en = f"https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles={urllib.parse.quote(title)}&redirects=1"
    req_en = urllib.request.Request(url_en, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    
    try:
        with urllib.request.urlopen(req_en, timeout=5) as response:
            data = json.loads(response.read().decode())
            pages = data.get('query', {}).get('pages', {})
            for page_id, page_data in pages.items():
                if 'original' in page_data and 'source' in page_data['original']:
                    return page_data['original']['source']
    except Exception as e:
        pass
        
    return None

def process_files():
    fixed_count = 0
    missing = []
    
    for root, dirs, files in os.walk(KNOWLEDGE_BASE_DIR):
        for file in files:
            if file.endswith(".md"):
                filepath = os.path.join(root, file)
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Check for image tag: ![...] (url)
                image_match = re.search(r'!\[.*?\]\((.*?)\)', content)
                
                # If there is no image, or if it uses a generic fallback image
                if not image_match or "Artificial_neural_network" in image_match.group(1) or "The_School_of_Athens" in image_match.group(1) or "Hubble_Ultra_Deep_Field" in image_match.group(1) or "Global_network.jpg" in image_match.group(1) or "Flammarion.jpg" in image_match.group(1) or "Van_Gogh_-_Starry_Night" in image_match.group(1) or "Human_brain_NIH" in image_match.group(1) or "Internet_map_1024" in image_match.group(1) or "NYSE_floor.jpg" in image_match.group(1) or "Consciousness.jpg" in image_match.group(1) or "Network_Representation.svg" in image_match.group(1):
                    
                    # Get title from H1
                    title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                    title = title_match.group(1) if title_match else file.replace('.md', '').replace('_', ' ').title()
                    
                    print(f"Suche echtes Bild für: {title}")
                    
                    # Search specific person instead of "monographie"
                    search_title = title.replace(" Monographie", "").replace(" masterclass", "").strip()
                    
                    real_image_url = get_wikipedia_image(search_title)
                    
                    if real_image_url:
                        print(f"  ✅ Gefunden: {real_image_url}")
                        
                        # Replace or inject
                        if image_match:
                            content = content.replace(image_match.group(0), f"![{search_title}]({real_image_url})")
                        else:
                            # Inject right after title
                            if title_match:
                                content = content.replace(title_match.group(0), f"{title_match.group(0)}\n\n![{search_title}]({real_image_url})\n\n", 1)
                        
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        fixed_count += 1
                    else:
                        print(f"  ❌ Kein Wikipedia-Bild gefunden für: {search_title}")
                        missing.append(search_title)
                    
                    time.sleep(0.5) # Avoid API rate limits
                    
    print("\n--- ZUSAMMENFASSUNG ---")
    print(f"Bilder repariert/eingefügt: {fixed_count}")
    if missing:
        print(f"Für {len(missing)} Einträge existiert absolut kein Bild in Wikipedia. Diese müssen manuell recherchiert werden.")

if __name__ == "__main__":
    print("Starte Wikipedia-Scraper für fehlende/generische Bilder...")
    process_files()
