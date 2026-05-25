import os
import requests

people = [
    {"title": "Gottfried Wilhelm Leibniz", "cat": "Philosophie/Rationalismus"},
    {"title": "Karl Marx", "cat": "Soziologie/Politische_Ökonomie"},
    {"title": "Hannah Arendt", "cat": "Philosophie/Politische_Theorie"},
    {"title": "Jean-Paul Sartre", "cat": "Philosophie/Existenzialismus"},
    {"title": "Simone de Beauvoir", "cat": "Philosophie/Existenzialismus"}
]

lib_dir = "/Users/ralfkirchner/spiral-os/knowledge_base/core_library"

for p in people:
    title = p['title']
    cat = p['cat']
    
    # fetch wiki image
    url = f"https://de.wikipedia.org/api/rest_v1/page/summary/{title.replace(' ', '_')}"
    headers = {"User-Agent": "SpiralWikiApp/1.0"}
    img_url = ""
    try:
        res = requests.get(url, headers=headers).json()
        if "thumbnail" in res:
            img_url = res["thumbnail"]["source"]
    except:
        pass

    cat_path = os.path.join(lib_dir, cat.split('/')[0])
    os.makedirs(cat_path, exist_ok=True)
    
    file_path = os.path.join(cat_path, f"{title.replace(' ', '_')}.md")
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            content = f"# {title}\n"
            if img_url:
                content += f"\n![{title}]({img_url})\n\n"
            content += f"**Kategorie:** {cat}\n\n"
            content += f"{title} war eine der bedeutendsten historischen Persönlichkeiten in der Domäne {cat.split('/')[0]}.\n"
            content += "\n## Kernkonzepte\n- Zentrales Paradigma\n- Historischer Kontext\n"
            f.write(content)
        print(f"Added {title}")

