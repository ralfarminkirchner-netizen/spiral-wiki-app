#!/usr/bin/env node
/**
 * fill-missing-images.js — FAST version
 * 
 * For the 57 obscure entries, uses parallel search with early exit:
 * 1. Wikidata (fastest for obscure people)
 * 2. DE + EN Wikipedia REST (most likely hits)
 * 3. Commons search
 * 4. DuckDuckGo instant answer
 * 5. Category-specific themed images from Wikimedia Commons (unique per entry)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../public/data.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function safeFetch(url, timeoutMs = 5000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: c.signal,
      headers: { 'User-Agent': 'SpiralMindWiki/2.0 (academic)' }
    });
    clearTimeout(t);
    return res;
  } catch { clearTimeout(t); return null; }
}

// ─── Search functions ───────────────────────────────────────

async function wikiRest(title, lang) {
  const res = await safeFetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (!res?.ok) return null;
  const d = await res.json();
  const url = d.originalimage?.source || d.thumbnail?.source;
  return url && !url.endsWith('.svg') ? url : null;
}

async function wikidataP18(title) {
  const res = await safeFetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(title)}&language=de&format=json&limit=3`);
  if (!res?.ok) return null;
  const d = await res.json();
  for (const e of (d.search || [])) {
    const cr = await safeFetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${e.id}&property=P18&format=json`);
    if (!cr?.ok) continue;
    const cd = await cr.json();
    const name = cd.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (name) {
      const f = name.replace(/ /g, '_');
      const h = crypto.createHash('md5').update(f).digest('hex');
      return `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0,2)}/${encodeURIComponent(f)}`;
    }
  }
  return null;
}

async function commonsSearch(title) {
  const res = await safeFetch(`https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)}&srnamespace=6&srlimit=5&format=json`);
  if (!res?.ok) return null;
  const d = await res.json();
  for (const r of (d.query?.search || [])) {
    if (/\.svg$/i.test(r.title) || /icon|logo|flag|coat|map/i.test(r.title)) continue;
    const ir = await safeFetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(r.title)}&prop=imageinfo&iiprop=url&format=json`);
    if (!ir?.ok) continue;
    const info = await ir.json();
    for (const p of Object.values(info.query?.pages || {})) {
      const url = p.imageinfo?.[0]?.url;
      if (url && !url.endsWith('.svg')) return url;
    }
  }
  return null;
}

async function ddgImage(title) {
  const res = await safeFetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(title)}&format=json&no_html=1&skip_disambig=1`);
  if (!res?.ok) return null;
  const d = await res.json();
  return d.Image?.startsWith('http') ? d.Image : null;
}

// ─── Themed category images (diverse, not just one per category) ──
const THEMED = {
  'Tradition': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Lucas_Cranach_d.%C3%84._-_Martin_Luther_%28Lutherhaus_Wittenberg%29.jpg/400px-Lucas_Cranach_d.%C3%84._-_Martin_Luther_%28Lutherhaus_Wittenberg%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Heliocentric.jpg/400px-Heliocentric.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Nuremberg_chronicles_f_237v_%28Trier%29.jpg/400px-Nuremberg_chronicles_f_237v_%28Trier%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Desidrius_Erasmus_by_Hans_Holbein.jpg/400px-Desidrius_Erasmus_by_Hans_Holbein.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Albrecht_D%C3%BCrer_-_Praying_Hands%2C_1508_-_Google_Art_Project.jpg/400px-Albrecht_D%C3%BCrer_-_Praying_Hands%2C_1508_-_Google_Art_Project.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Gutenberg_Bible%2C_Lenox_Copy%2C_New_York_Public_Library%2C_2009._Pic_01.jpg/400px-Gutenberg_Bible%2C_Lenox_Copy%2C_New_York_Public_Library%2C_2009._Pic_01.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Jan_van_Eyck_-_The_Ghent_Altarpiece_-_The_Adoration_of_the_Mystic_Lamb_-_Google_Art_Project.jpg/400px-Jan_van_Eyck_-_The_Ghent_Altarpiece_-_The_Adoration_of_the_Mystic_Lamb_-_Google_Art_Project.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Illuminated_initial_from_Anselm%27s_Monologion.jpg/400px-Illuminated_initial_from_Anselm%27s_Monologion.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Meister_Francke_-_Passionsaltar_%281424%29.jpg/400px-Meister_Francke_-_Passionsaltar_%281424%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Rembrandt_Harmensz._van_Rijn_-_Return_of_the_Prodigal_Son_-_Google_Art_Project.jpg/400px-Rembrandt_Harmensz._van_Rijn_-_Return_of_the_Prodigal_Son_-_Google_Art_Project.jpg',
  ],
  'Psychologie': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Rorschach_blot_03.jpg/400px-Rorschach_blot_03.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Rorschach_blot_04.jpg/400px-Rorschach_blot_04.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Rorschach_blot_05.jpg/400px-Rorschach_blot_05.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Rorschach_blot_06.jpg/400px-Rorschach_blot_06.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Rorschach_blot_07.jpg/400px-Rorschach_blot_07.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Rorschach_blot_08.jpg/400px-Rorschach_blot_08.jpg',
  ],
  'Soziologie': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/All_Giza_Pyramids.jpg/400px-All_Giza_Pyramids.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/400px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Adolphe_Quetelet_by_Joseph-Arnold_Demannez.jpg/400px-Adolphe_Quetelet_by_Joseph-Arnold_Demannez.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Crowd_outside_the_Stock_Exchange%2C_New_York%2C_1900.jpg/400px-Crowd_outside_the_Stock_Exchange%2C_New_York%2C_1900.jpg',
  ],
  'Wissenschaft': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Sundial_2.jpg/400px-Sundial_2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg/400px-Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Igloo_spirridge.jpg/400px-Igloo_spirridge.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Desmond_Tutu_2004-04-22.jpg/400px-Desmond_Tutu_2004-04-22.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Darwin%27s_finches_by_Gould.jpg/400px-Darwin%27s_finches_by_Gould.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/VanGogh-starry_night_ballance1.jpg/400px-VanGogh-starry_night_ballance1.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/400px-Camponotus_flavomarginatus_ant.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Hubble_ultra_deep_field.jpg/400px-Hubble_ultra_deep_field.jpg',
  ],
  'Wirtschaft': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/New_York_Stock_Exchange_1908.jpg/400px-New_York_Stock_Exchange_1908.jpg',
  ],
  'default': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Hubble_Ultra_Deep_Field_part_d.jpg/400px-Hubble_Ultra_Deep_Field_part_d.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/400px-Camponotus_flavomarginatus_ant.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flammarion_Woodcut_1888.jpg/400px-Flammarion_Woodcut_1888.jpg',
  ],
};

function getThemedFallback(category, index) {
  for (const [key, urls] of Object.entries(THEMED)) {
    if (key !== 'default' && category.includes(key)) {
      return urls[index % urls.length];
    }
  }
  return THEMED.default[index % THEMED.default.length];
}

// ─── Race-based search: run all strategies in parallel, first wins ──
async function findImageFast(title, category, idx) {
  // Try name + without umlauts
  const names = [title];
  const deUmlaut = title.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue');
  if (deUmlaut !== title) names.push(deUmlaut);
  
  // Race all strategies in parallel for speed
  const promises = [];
  for (const name of names) {
    promises.push(wikiRest(name, 'de').then(u => u ? { url: u, src: 'de.wiki' } : null));
    promises.push(wikiRest(name, 'en').then(u => u ? { url: u, src: 'en.wiki' } : null));
    promises.push(wikidataP18(name).then(u => u ? { url: u, src: 'wikidata' } : null));
    promises.push(commonsSearch(name).then(u => u ? { url: u, src: 'commons' } : null));
    promises.push(ddgImage(name).then(u => u ? { url: u, src: 'ddg' } : null));
  }
  
  // Promise.any returns the first resolved non-null
  try {
    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) return r.value;
    }
  } catch { /* all failed */ }
  
  return { url: getThemedFallback(category, idx), src: 'themed fallback' };
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  const missing = data.filter(e => !e.imageUrl || e.imageUrl.startsWith('data:image/svg'));
  
  console.log(`\n🔍 ${missing.length} Einträge ohne echtes Bild.\n`);
  
  let real = 0, fallback = 0;
  
  // Process in batches of 5 for speed while being polite
  const BATCH = 5;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((e, j) => findImageFast(e.title, e.category, i + j)));
    
    for (let j = 0; j < batch.length; j++) {
      const entry = batch[j];
      const result = results[j];
      entry.imageUrl = result.url;
      const isFallback = result.src.includes('fallback');
      if (isFallback) fallback++; else real++;
      console.log(`[${i+j+1}/${missing.length}] ${entry.title} → ${isFallback ? '🎨' : '✅'} ${result.src}`);
    }
    
    if (i + BATCH < missing.length) await sleep(300);
  }
  
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
  const jsFile = path.resolve(__dirname, '../public/appData.js');
  fs.writeFileSync(jsFile, `const windowWikiData = ${JSON.stringify(data, null, 2)};`, 'utf-8');
  
  console.log(`\n✨ ${real} echte Bilder, ${fallback} thematische Fallbacks.`);
  console.log(`📄 data.json aktualisiert.\n`);
}

main().catch(console.error);
