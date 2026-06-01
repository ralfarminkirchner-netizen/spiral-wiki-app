const fs = require('fs');
const path = require('path');

const titles = [
  'Marvin Harris', 'Max Gluckman', 'Victor Turner', 'Bernard Baars', 'Synthetische Evolutionstheorie',
  'Zelltheorie', 'Turingmaschine', 'Emergenz', 'Virginia Woolf', 'Macy-Konferenzen',
  'György Buzsáki', 'Paul Churchland', 'Friedrich Nietzsche', 'Stoizismus', 'Erlanger Konstruktivismus',
  'George Kelly (Psychologe)', 'Konstruktivistische Didaktik', 'Konstruktivistische Erkenntnistheorie', 
  'Peter L. Berger', 'Sozialkonstruktivismus', 'Standardmodell', 'Charles W. Morris',
  'A.H. Almaas', 'P. D. Ouspensky', 'Janina Fisher', 'Komplexe posttraumatische Belastungsstörung',
  'Michaela Huber', 'Onno van der Hart', 'Pat Ogden', 'Rachel Yehuda', 'Richard C. Schwartz', 
  'Arthur Janov', 'Ida Rolf', 'Stanley Keleman', 'E. F. Schumacher', 'Klimapsychologie', 'Tiefenökologie'
];

// Provide some mapping to real wikipedia page titles or directly fetch
async function run() {
  const overrides = {};
  for (const t of titles) {
    try {
      const res = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`);
      const data = await res.json();
      if (data.thumbnail && data.thumbnail.source) {
        overrides[t] = data.thumbnail.source;
      } else {
        const enRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`);
        const enData = await enRes.json();
        if (enData.thumbnail && enData.thumbnail.source) {
          overrides[t] = enData.thumbnail.source;
        }
      }
    } catch (e) {}
  }
  fs.writeFileSync(path.join(__dirname, 'auto-fetched-images.json'), JSON.stringify(overrides, null, 2));
}
run();
