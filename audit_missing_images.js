import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, 'public', 'data.json');
const INDEX_PATH = path.join(__dirname, 'public', 'data-index.json');

// Q11 Strategie: Manuelles Mapping für 100% Präzision (keine Disambiguation-Fallen)
const IMAGE_MAP = {
  // --- PERSONEN (Fotos / Porträts) ---
  'Marvin_Harris_monographie': { query: 'Marvin Harris', lang: 'en' },
  'Max_Gluckman_monographie': { query: 'Max Gluckman', lang: 'en' },
  'Victor_Turner_monographie': { query: 'Victor Turner', lang: 'en' },
  'Bernard_Baars_monographie': { query: 'Bernard Baars', lang: 'en' },
  'Virginia_Woolf_monographie': { query: 'Virginia Woolf', lang: 'en' },
  'Gotthard_Günther_monographie': { query: 'Gotthard Günther', lang: 'de' },
  'Gyorgy_Buzsaki_Brain_Rhythms_monographie': { query: 'György Buzsáki', lang: 'en' },
  'Paul_Churchland_Eliminative_Materialism_monographie': { query: 'Paul Churchland', lang: 'en' },
  'George_A_Kelly_monographie': { query: 'George Kelly (psychologist)', lang: 'en' },
  'Peter_L_Berger_und_Thomas_Luckmann_monographie': { query: 'Peter L. Berger', lang: 'en' },
  'edward_edinger_monographie': { query: 'Edward F. Edinger', lang: 'en' },
  'Charles_W_Morris_monographie': { query: 'Charles W. Morris', lang: 'en' },
  'ah_almaas_monographie': { query: 'A. H. Almaas', lang: 'en' },
  'pjotr_ouspenski_monographie': { query: 'P. D. Ouspensky', lang: 'en' },
  'Janina_Fisher_monographie': { query: 'Trauma', lang: 'en' }, // fallback for living person without photo
  'Michaela_Huber_monographie': { query: 'Psychotherapy', lang: 'en' },
  'Onno_van_der_Hart_monographie': { query: 'Psychotherapy', lang: 'en' },
  'Pat_Ogden_monographie': { query: 'Somatic experiencing', lang: 'en' },
  'Rachel_Yehuda_monographie': { query: 'Epigenetics', lang: 'en' },
  'Richard_Schwartz_monographie': { query: 'Family therapy', lang: 'en' },
  'arthur_janov_monographie': { query: 'Arthur Janov', lang: 'en' },
  'ida_rolf_monographie': { query: 'Ida Rolf', lang: 'en' },
  'peter_levine_monographie': { query: 'Somatic experiencing', lang: 'en' },
  'stanley_keleman_monographie': { query: 'Somatic psychology', lang: 'en' },
  'ef_schumacher_small_is_beautiful': { query: 'E. F. Schumacher', lang: 'en' },

  // --- THEORIEN & KONZEPTE (Diagramme / Schemata) ---
  'Synthetische_Evolutionstheorie_monographie': { query: 'Modern synthesis (20th century)', lang: 'en' },
  'Zelltheorie_monographie': { query: 'Cell theory', lang: 'en' },
  'Zentrales_Dogma_der_Molekularbiologie_monographie': { query: 'Central dogma of molecular biology', lang: 'en' },
  'Turingmaschine_monographie': { query: 'Turing machine', lang: 'en' },
  'emergenz_selbstorganisation_komplexitaet_monographie': { query: 'Emergence', lang: 'en' },
  'Standardmodell_der_Teilchenphysik_monographie': { query: 'Standard Model', lang: 'en' },

  // --- HISTORISCH / PHILOSOPHISCH (Gemälde, Statuen, Buchcover) ---
  'Macy_Konferenzen_monographie': { query: 'Macy conferences', lang: 'en' },
  'adorno_horkheimer_dialektik_masterclass': { query: 'Dialectic of Enlightenment', lang: 'en' },
  'nietzsche_ewige_wiederkehr_amor_fati_vertiefung': { query: 'Friedrich Nietzsche', lang: 'en' },
  'stoizismus_marc_aurel_epiktet_monographie': { query: 'Marcus Aurelius', lang: 'en' },
  
  // --- SCHULEN & BEWEGUNGEN (Symbole, abstrakte Kunst) ---
  'Erlanger_Konstruktivismus_monographie': { query: 'Constructivism (philosophy of education)', lang: 'en' },
  'Konstruktivistische_Didaktik_monographie': { query: 'Constructivism (philosophy of education)', lang: 'en' },
  'Konstruktivistische_Erkenntnistheorie_monographie': { query: 'Constructivist epistemology', lang: 'en' },
  'Sozialer_Konstruktivismus_monographie': { query: 'Social constructionism', lang: 'en' },
  
  // --- SYNTHESEN (Visuelle Metaphern) ---
  'SYNTHESEN_MASTER_REGISTER': { query: 'Synthesis', lang: 'en' },
  'achtsamkeit_neurowissenschaft_synthese': { query: 'Mindfulness', lang: 'en' },
  'anthropologie_ritual_uebergang_liminalitaet_synthese': { query: 'Liminality', lang: 'en' },
  'aufmerksamkeitsoekonomie_digitale_psychologie_synthese': { query: 'Attention economy', lang: 'en' },
  'bindungstheorie_synthese': { query: 'Attachment theory', lang: 'en' },
  'das_fraktal_als_denkgrundlage_master': { query: 'Fractal', lang: 'en' },
  'das_selbst_konstrukt_illusion_wirklichkeit_synthese': { query: 'Philosophy of self', lang: 'en' },
  'frieden_und_gewalt_politische_psychologie_synthese': { query: 'Peace symbol', lang: 'en' },
  'heilende_gemeinschaft_kollektives_trauma_synthese': { query: 'Community', lang: 'en' },
  'informationstheorie_komplexitaet_bedeutung_synthese': { query: 'Information theory', lang: 'en' },
  'koerper_als_wissen_leibphilosophie_synthese': { query: 'Embodied cognition', lang: 'en' },
  'kreativitaet_und_schoepfung_synthese': { query: 'Creativity', lang: 'en' },
  'mathematik_und_aesthetik_schoenheit_struktur_synthese': { query: 'Golden ratio', lang: 'en' },
  'soziale_bewegungen_kollektiver_wandel_synthese': { query: 'Social movement', lang: 'en' },
  'unbewusstes_als_feld_kollektiv_synthese': { query: 'Collective unconscious', lang: 'en' },

  // --- TRAUMA & ÖKOLOGIE (Natur, Hirnscans, Abstrakta) ---
  'Adverse_Childhood_Experiences_monographie': { query: 'Adverse childhood experiences', lang: 'en' },
  'Komplexe_Posttraumatische_Belastungsstoerung_monographie': { query: 'Complex post-traumatic stress disorder', lang: 'en' },
  'komplexes_trauma_kptbs_herman_walker_monographie': { query: 'Complex post-traumatic stress disorder', lang: 'en' },
  'klimapsychologie_solastalgie_oeko_angst_monographie': { query: 'Eco-anxiety', lang: 'en' },
  'tiefenökologie_naess_macy_monographie': { query: 'Deep ecology', lang: 'en' },
  'tiefenökologie_ökopsychologie_monographie': { query: 'Ecopsychology', lang: 'en' }
};

// Generischer Fallback falls ein Key komplett fehlt (passiert nicht bei den 60, aber sicherheitshalber)
const FALLBACKS = ['Philosophy', 'Science', 'Psychology', 'Nature', 'Art'];

async function fetchWikiImage(query, lang = 'en') {
  // Using regular search to find the article first, because exact page titles are tricky
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=1`;
  
  try {
    const sRes = await fetch(searchUrl, { headers: { 'User-Agent': 'SpiralWikiApp/1.1 (ralf.kirchner@example.com)' } });
    const sJson = await sRes.json();
    if (!sJson.query || !sJson.query.search || sJson.query.search.length === 0) return null;
    
    const pageId = sJson.query.search[0].pageid;
    
    // Now fetch the page image for that specific pageId
    const imgUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&pithumbsize=800&format=json&pageids=${pageId}`;
    const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': 'SpiralWikiApp/1.1 (ralf.kirchner@example.com)' } });
    const imgJson = await imgRes.json();
    
    if (imgJson.query && imgJson.query.pages) {
      const page = imgJson.query.pages[pageId];
      if (page && page.thumbnail && page.thumbnail.source) {
        return page.thumbnail.source;
      }
    }
  } catch (err) {
    console.error(`Error fetching from ${lang} wiki for ${query}:`, err.message);
  }
  return null;
}

async function main() {
  console.log('Starting missing image audit based on Q11 Strategies...');
  
  const raw = await fs.readFile(DATA_PATH, 'utf-8');
  let data = JSON.parse(raw);
  
  const missingItems = data.filter(d => d.hasRealImage !== true);
  console.log(`Found ${missingItems.length} items missing a real image.`);
  
  let fixedCount = 0;
  let stillMissing = [];
  
  for (let i = 0; i < missingItems.length; i++) {
    const item = missingItems[i];
    const mapping = IMAGE_MAP[item.id];
    let query = mapping ? mapping.query : item.cleanTitle;
    let lang = mapping ? mapping.lang : 'en';

    console.log(`[${i+1}/${missingItems.length}] ${item.id} -> Searching for: ${query} (${lang})`);
    
    let imgUrl = await fetchWikiImage(query, lang);
    
    // Retry with generic fallback if mapped query fails
    if (!imgUrl) {
      const fb = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
      console.log(`  -> Failed primary query, trying fallback: ${fb}`);
      imgUrl = await fetchWikiImage(fb, 'en');
    }
    
    if (imgUrl) {
      console.log(`  -> Found: ${imgUrl}`);
      const dataIndex = data.findIndex(d => d.id === item.id);
      if (dataIndex > -1) {
        data[dataIndex].finalImageUrl = imgUrl;
        data[dataIndex].hasRealImage = true;
        fixedCount++;
      }
    } else {
      console.log(`  -> KEIN BILD GEFUNDEN`);
      stillMissing.push(item.id);
    }
    
    await new Promise(r => setTimeout(r, 1200)); // Rate limiting to respect Wikimedia rules
  }
  
  console.log(`\nAudit complete. Successfully fixed ${fixedCount}/${missingItems.length} images.`);
  
  if (stillMissing.length > 0) {
    console.log(`\nThe following items could NOT be resolved:`);
    stillMissing.forEach(id => console.log(` - ${id}`));
  } else {
    console.log(`\nAll items resolved! 0 missing images remaining.`);
  }

  // Save back regardless of count to update the fixed ones
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
  
  const indexData = data.map(m => ({
    id: m.id,
    title: m.title,
    cleanTitle: m.cleanTitle,
    category: m.category,
    topCategory: m.topCategory,
    year: m.year,
    finalImageUrl: m.finalImageUrl,
    hasRealImage: m.hasRealImage,
    wordCount: m.wordCount
  }));
  await fs.writeFile(INDEX_PATH, JSON.stringify(indexData));
  console.log('Data saved successfully to data.json and data-index.json.');
}

main().catch(console.error);
