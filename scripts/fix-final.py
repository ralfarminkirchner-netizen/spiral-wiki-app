#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply fixes from browser audit v-final: 149 broken entries."""
import json, hashlib, shutil

# EXACT titles from browser audit (copied from subagent output)
BROKEN = [
    "Donald Hoffman","Panpsychismus","Feedback-Schleifen","Kybernetik zweiter Ordnung",
    "Viable System Model","Russell Barkley","Lorna Wing","Edward Hallowell",
    "V.S. Ramachandran","Das Korrelat des Bewusstseins","Split-Brain-Forschung",
    "Ego-Tunnel","Predictive Processing","Phantomschmerz","Somatische Marker",
    "System 1 und System 2","Weltseele","Gregory Bateson","Emanation","Theurgie",
    "Das Eine","Porphyrios","Jamblichos","Sri Ramana Maharshi","Thich Nhat Hanh",
    "Logos","Disziplinargesellschaft","\u00dcberwachungskapitalismus","Das Spektakel",
    "Kapitalistischer Realismus","Andreas Volanus","Andreas Wilms",
    "Analytische Philosophie","Andreas Poach","Dereflexion","Existentielles Vakuum",
    "Carl Gustav Jung","Wille zum Sinn","Heinz Kohut","Marsha Linehan",
    "Paradoxe Intention","Trotzmacht des Geistes","Otto Kernberg",
    "Almuth Bruder-Bezzel","EMDR","Judith Herman","Alexander von Eye","Peter Levine",
    "Francine Shapiro","Alison Elliot","Epigenetische Traumavererbung",
    "Somatic Experiencing","Polyvagal-Theorie","Amos Tversky","Andreas Beelmann",
    "Anne B\u00f6ckler-Raettig","Archetypische Psychologie nach James Hillman",
    "Annelies Argelander","Antje-Kathrin Allgaier","Annemarie Buchholz-Kaiser",
    "Arthur Aron","Antje Ducki","Arndt Br\u00f6der","Arnold Sherwood Tannenbaum",
    "August Dvorak","John Bowlby","Humanistische Psychologie",
    "Behaviorismus und Kognitive Psychologie","Carl Jung","C.G. Jung",
    "Milton Erickson","Transpersonale Psychologie und Bewusstseinsstufen",
    "Steve de Shazer","Shunryu Suzuki","Dogen Zenji","Laozi","Valentinus",
    "Zhuangzi","Yin und Yang","Wu Wei","Zen-Buddhismus","Mary Douglas",
    "Die St\u00e4rke schwacher Bindungen","Neil Postman","Preferential Attachment",
    "Soziales Kapital","Skalenfreie Netzwerke","Small-World-Ph\u00e4nomen",
    "Alfred Richter","Andr\u00e9 Bleicher","Angelika Ebbinghaus","Mark Granovetter",
    "Andr\u00e9 Gunder Frank","Andreas von Meyendorff","Aly Mazah\u00e9ri",
    "Annette Spellerberg","Aram Ziai","Stuart Hall","Crossover-Dossier",
    "Andrei Anatoljewitsch Atutschin","Andreas Fischer-Nagel","Neurotheologie",
    "Laotse","Dschalal ad-Din Rumi","D.T. Suzuki","Siddharta Gautama / Buddha",
    "Ali ibn Sahl Isfahani","Aleydis von Schaerbeek","Alfons Rosenberg",
    "Andreas E\u00f6ssi","Alfonso Paleotti","Antonino da Patti","Anna Vetter",
    "Anton Musa","Anton Corvinus","Anton Anger","Antoine Yvan","Antoine Froment",
    "Antonius Schirley","Valentinianische Gnosis","Arsacius Seehofer",
    "Aszelina von Boulancourt","Ateshbaz-\u0131 Veli","Augustin Himmel",
    "Augustin Gschmus","Gnosis und Hermetik","Gnosis","Allmende",
    "Die unsichtbare Hand","Sch\u00f6pferische Zerst\u00f6rung","Neurogenese",
    "Hebbsche Lernregel","Entropie","Synaptic Pruning","Neuronale Netze",
    "Katalyse","Das Periodensystem","Unvollst\u00e4ndigkeitssatz",
    "Poststrukturalismus","John Nash","Thomas Fuchs","Donella Meadows",
    "Prim\u00e4rquellen","Andreas Hensel","Anna Cord","Arthur B. Chatelain",
    "Armin Hildebrandt","Arvin C. Diesmos","Die Geschichte der Quantenmechanik",
]

BROKEN_SET = set(BROKEN)

FB = {
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
    'Traumaforschung': ['https://upload.wikimedia.org/wikipedia/commons/6/6e/Rorschach_blot_01.jpg'],
}

def pick(cat, title):
    top = cat.split('/')[0].strip().replace('_', ' ')
    pool = FB.get('Philosophie')
    for key in FB:
        if key in top or top in key:
            pool = FB[key]
            break
    return pool[int(hashlib.md5(title.encode()).hexdigest(), 16) % len(pool)]

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

print(f"Fixed {fixed}/{len(BROKEN)}")
if remaining:
    print(f"UNMATCHED ({len(remaining)}):")
    for t in sorted(remaining):
        print(f"  '{t}'")

# Save everywhere
with open('public/data.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
with open('public/appData.js', 'w') as f:
    f.write('const windowWikiData = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';')
shutil.copy2('public/appData.js', 'dist/appData.js')

# NOW generate audit page with FIXED data
e2 = [{'title': x.get('title',''), 'imageUrl': x.get('imageUrl','')} for x in data]
html = '''<!DOCTYPE html><html><head><title>VERIFY2</title>
<style>body{background:#111;color:#fff;font:12px monospace}.f{color:#f44}
#s{position:fixed;top:0;left:0;right:0;background:#222;padding:8px;z-index:99}
#r{margin-top:40px}</style></head><body>
<div id=s>...</div><div id=r></div><script>
const E=''' + json.dumps(e2) + ''';
const R=document.getElementById('r'),S=document.getElementById('s');
let o=0,f=0,t=0;const F=[];
function T(e){return new Promise(r=>{const i=new Image();
const x=setTimeout(()=>{i.src='';f++;t++;F.push(e.title);
R.innerHTML+='<div class=f>'+e.title+'</div>';
S.textContent=t+'/'+E.length+' ok'+o+' fail'+f;r()},8000);
i.onload=()=>{clearTimeout(x);o++;t++;
S.textContent=t+'/'+E.length+' ok'+o+' fail'+f;r()};
i.onerror=()=>{clearTimeout(x);f++;t++;F.push(e.title);
R.innerHTML+='<div class=f>'+e.title+'</div>';
S.textContent=t+'/'+E.length+' ok'+o+' fail'+f;r()};
i.src=e.imageUrl})}
async function run(){for(let i=0;i<E.length;i+=15){
await Promise.all(E.slice(i,i+15).map(e=>T(e)))}
S.textContent='DONE '+t+'/'+E.length+' ok'+o+' fail'+f;
R.innerHTML+='<pre id=j>'+JSON.stringify(F)+'</pre>'}
run();</script></body></html>'''
with open('dist/image-audit.html', 'w') as f:
    f.write(html)
print("Saved + audit generated with FIXED data!")
