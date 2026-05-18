#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, hashlib

BROKEN_TITLES = set([
    "Panpsychismus","Donald Hoffman","Hyperrealitaet","Historiografische Metafiktion",
    "Intertextualitaet","Tod des Autors","Kuenstliche Intelligenz in der Sci-Fi",
    "Posthumanismus","Stanislaw Lem","Viable System Model","Feedback-Schleifen",
    "Kybernetik zweiter Ordnung","Edward Hallowell","Lorna Wing","Russell Barkley",
    "Das Korrelat des Bewusstseins","Phantomschmerz","Ego-Tunnel","Predictive Processing",
    "Somatische Marker","Split-Brain-Forschung","System 1 und System 2","V.S. Ramachandran",
    "Thomas Kuhn","Gregory Bateson","Das Eine","Emanation","Theurgie","Weltseele",
    "Jamblichos","Porphyrios","Pseudo-Dionysius Areopagita","Sri Ramana Maharshi",
    "Thich Nhat Hanh","Amor Fati","Dichotomie der Kontrolle","Memento Mori",
    "Das Simulakrum","Disziplinargesellschaft","Das Spektakel","Kapitalistischer Realismus",
    "Ambrosius Feierabend","Analytische Philosophie","Andreas Wilms","Andreas Volanus",
    "Andreas Kauxdorf","Andreas Poach","Existentialismus und Phaenomenologie","Paul Virilio",
    "Roland Barthes","Dereflexion","Existentielles Vakuum","Paradoxe Intention",
    "Trotzmacht des Geistes","Wille zum Sinn","Marsha Linehan","Otto Kernberg",
    "Heinz Kohut","Carl Gustav Jung","EMDR","Somatic Experiencing",
    "Epigenetische Traumavererbung","Alexander von Eye","Judith Herman","Peter Levine",
    "Almuth Bruder-Bezzel","Alison Elliot","Francine Shapiro","Amos Tversky",
    "Andreas Beelmann","Arndt Broeder","Annelies Argelander","Annemarie Buchholz-Kaiser",
    "Antje Ducki","Arthur Aron","Archetypische Psychologie nach James Hillman",
    "Arnold Sherwood Tannenbaum","August Dvorak","Behaviorismus und Kognitive Psychologie",
    "Carl Jung","Humanistische Psychologie","John Bowlby","Milton Erickson",
    "Steve de Shazer","Transpersonale Psychologie und Bewusstseinsstufen","Dogen Zenji",
    "Shunryu Suzuki","Dao","Wu Wei","Laozi","Yin und Yang","Zhuangzi","Mani",
    "Valentinus","Zen-Buddhismus","Mary Douglas","Neil Postman","Preferential Attachment",
    "Skalenfreie Netzwerke","Soziales Kapital","Mark Granovetter",
    "Andreas von Meyendorff","Angelika Ebbinghaus","Alfred Richter","Annette Spellerberg",
    "Aram Ziai","Stuart Hall","Andreas Fischer-Nagel","Andrei Anatoljewitsch Atutschin",
    "Neurotheologie","Crossover-Dossier","Laotse","D.T. Suzuki","Alfons Rosenberg",
    "Aleydis von Schaerbeek","Andreas Eoessi","Ali ibn Sahl Isfahani","Alfonso Paleotti",
    "Antonino da Patti","Antoine Froment","Anton Anger","Anna Vetter","Anton Corvinus",
    "Antoine Yvan","Anton Musa","Aszelina von Boulancourt","Antonius Schirley",
    "Valentinianische Gnosis","Arsacius Seehofer","Augustin Gschmus","Augustin Himmel",
    "Gnosis und Hermetik","Gnosis","Allmende","Brain-Derived Neurotrophic Factor",
    "Hebbsche Lernregel","Long-Term Potentiation","Neurogenese","Donald Hebb",
    "Synaptic Pruning","Norman Doidge","Michael Merzenich","Chemische Bindung",
    "Das Periodensystem","Dmitri Mendelejew","Diskursanalyse","Poststrukturalismus",
    "Signifikant und Signifikat","Strukturalismus","John Nash","Karl Friston",
    "Thomas Fuchs","Donella Meadows","Die Geschichte der Quantenmechanik",
    "Systemtheorie und Kybernetik","Kybernetik 2.0",
])

P = {
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

def pick(cat, title):
    top = cat.split('/')[0].strip().replace('_',' ')
    pool = P.get('Philosophie')
    for key in P:
        if key in top or top in key: pool = P[key]; break
    return pool[int(hashlib.md5(title.encode()).hexdigest(),16) % len(pool)]

with open('public/data.json') as f:
    data = json.load(f)

# Also collect all actual titles for fuzzy matching
all_titles = {e['title'] for e in data}

# Normalize function for matching
import unicodedata
def norm(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower().strip()

norm_map = {norm(t): t for t in all_titles}
broken_norm = {norm(t): t for t in BROKEN_TITLES}

fixed = 0
for e in data:
    title = e.get('title', '')
    nt = norm(title)
    if title in BROKEN_TITLES or nt in broken_norm:
        e['imageUrl'] = pick(e.get('category', ''), title)
        fixed += 1

print(f"Fixed {fixed} entries")

# Save
with open('public/data.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
with open('public/appData.js', 'w') as f:
    f.write('const windowWikiData = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';')
import shutil
shutil.copy2('public/appData.js', 'dist/appData.js')
print("Saved + synced!")
