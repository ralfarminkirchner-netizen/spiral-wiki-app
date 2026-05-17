#!/usr/bin/env node
/**
 * Standalone script to fetch missing images for all monographs.
 * Uses 5 sources: EN Wikipedia, DE Wikipedia, Wikidata, OG:Image, Bing.
 * Run: node scripts/fetch-missing-images.js
 * 
 * This updates data.json and appData.js IN-PLACE with newly found images.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchImageWithFallback } from './image-fetcher.js';
import pLimit from './limit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const dataFile = path.join(publicDir, 'data.json');
const jsFile = path.join(publicDir, 'appData.js');

async function run() {
  if (!fs.existsSync(dataFile)) {
    console.error('❌ data.json nicht gefunden. Erst: node scripts/build-wiki-data.js');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  const missing = data.filter(d => !d.imageUrl);
  
  console.log(`📊 Total: ${data.length} Monographien`);
  console.log(`❌ Ohne Bild: ${missing.length}`);
  
  if (missing.length === 0) {
    console.log('✅ Alle Monographien haben bereits Bilder!');
    return;
  }

  console.log('🔍 Starte Multi-Source Bildsuche...\n');
  
  const limit = pLimit(5); // conservative concurrency
  let found = 0;
  let failed = 0;

  await Promise.all(missing.map(m => limit(async () => {
    const url = await fetchImageWithFallback(m.title);
    if (url) {
      m.imageUrl = url;
      found++;
    } else {
      failed++;
    }
  })));

  console.log(`\n📈 Ergebnis:`);
  console.log(`  ✅ Gefunden: ${found}`);
  console.log(`  ❌ Nicht gefunden: ${failed}`);
  console.log(`  📊 Deckung: ${Math.round(((data.length - (missing.length - found)) / data.length) * 100)}%`);

  // Write updated data
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(dataFile, json, 'utf-8');
  fs.writeFileSync(jsFile, `const windowWikiData = ${json};`, 'utf-8');
  console.log('\n💾 data.json und appData.js aktualisiert.');
  console.log('⚡ Jetzt: npx vite build && git push');
}

run().catch(e => { console.error(e); process.exit(1); });
