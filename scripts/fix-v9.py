#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix all 142 remaining broken images using exact title matching from audit."""
import json, hashlib, shutil

# Exact titles from browser audit v9
BROKEN = [
    "Panpsychismus","Donald Hoffman","Kybernetik zweiter Ordnung","Viable System Model",
    "Feedback-Schleifen","Russell Barkley","Lorna Wing","Edward Hallowell",
    "System 1 und System 2","Phantomschmerz","V.S. Ramachandran",
    "Das Korrelat des Bewusstseins","Somatische Marker","Split-Brain-Forschung",
    "Predictive Processing","Ego-Tunnel","Gregory Bateson","Emanation","Weltseele",
    "Theurgie","Das Eine","Jamblichos","Sri Ramana Maharshi","Porphyrios",
    "Thich Nhat Hanh","\u00dcberwachungskapitalismus","Das Spektakel",
    "Disziplinargesellschaft","Kapitalistischer Realismus","Andreas Volanus",
    "Analytische Philosophie","Andreas Wilms","Andreas Poach","Frantz Fanon",
    "Dereflexion","Existentielles Vakuum","Marsha Linehan","Paradoxe Intention",
    "Heinz Kohut","Trotzmacht des Geistes","Carl Gustav Jung","Wille zum Sinn",
    "Otto Kernberg","EMDR","Judith Herman","Alexander von Eye","Polyvagal-Theorie",
    "Almuth Bruder-Bezzel","Alison Elliot","Francine Shapiro","Peter Levine",
    "Epigenetische Traumavererbung","Somatic Experiencing","Amos Tversky",
    "Andreas Beelmann","Antje-Kathrin Allgaier","Anne B\u00f6ckler-Raettig",
    "Arndt Br\u00f6der","Archetypische Psychologie nach James Hillman",
    "Annelies Argelander","Annemarie Buchholz-Kaiser","Arthur Aron","Antje Ducki",
    "Arnold Sherwood Tannenbaum","August Dvorak","John Bowlby",
    "Humanistische Psychologie","Behaviorismus und Kognitive Psychologie","Carl Jung",
    "Milton Erickson","Transpersonale Psychologie und Bewusstseinsstufen",
    "Steve de Shazer","Shunryu Suzuki","Dogen Zenji","Yin und Yang","Zhuangzi",
    "Wu Wei","Valentinus","Laozi","Zen-Buddhismus","Mary Douglas","Soziales Kapital",
    "Neil Postman","Preferential Attachment","Die St\u00e4rke schwacher Bindungen",
    "Skalenfreie Netzwerke","Small-World-Ph\u00e4nomen","Alfred Richter",
    "Angelika Ebbinghaus","Mark Granovetter","Andr\u00e9 Gunder Frank",
    "Aly Mazah\u00e9ri","Andr\u00e9 Bleicher","Andreas von Meyendorff",
    "Annette Spellerberg","Aram Ziai","Stuart Hall",
    "Andrei Anatoljewitsch Atutschin","Crossover-Dossier","Neurotheologie",
    "Andreas Fischer-Nagel","Laotse","Dschalal ad-Din Rumi","D.T. Suzuki",
    "Ali ibn Sahl Isfahani","Aleydis von Schaerbeek","Th\u00edch Nh\u1ea5t H\u1ea1nh",
    "Alfons Rosenberg","Andreas E\u00f6ssi","Alfonso Paleotti",
    "Siddharta Gautama / Buddha","Anton Corvinus","Antonino da Patti","Anna Vetter",
    "Anton Anger","Anton Musa","Antoine Yvan","Antoine Froment",
    "Aszelina von Boulancourt","Valentinianische Gnosis","Arsacius Seehofer",
    "Augustin Gschmus","Ateshbaz-\u0131 Veli","Augustin Himmel","Antonius Schirley",
    "Gnosis","Gnosis und Hermetik","Allmende","Sch\u00f6pferische Zerst\u00f6rung",
    "Die unsichtbare Hand","Hebbsche Lernregel","Neurogenese","Synaptic Pruning",
    "Das Periodensystem","Unvollst\u00e4ndigkeitssatz","Poststrukturalismus",
    "Donella Meadows","John Nash","Thomas Fuchs","Prim\u00e4rquellen",
    "Allgemeine Relativit\u00e4tstheorie und Kosmologie",
    "Die Geschichte der Quantenmechanik",
]

BROKEN_SET = set(BROKEN)

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

fixed = 0
remaining = set(BROKEN_SET)
for e in data:
    title = e.get('title', '')
    if title in BROKEN_SET:
        e['imageUrl'] = pick(e.get('category', ''), title)
        fixed += 1
        remaining.discard(title)

print(f"Fixed {fixed}/{len(BROKEN)} entries")
if remaining:
    print(f"Unmatched ({len(remaining)}):")
    for t in sorted(remaining):
        print(f"  '{t}'")

with open('public/data.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
with open('public/appData.js', 'w') as f:
    f.write('const windowWikiData = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';')
shutil.copy2('public/appData.js', 'dist/appData.js')
print("Saved + synced!")
