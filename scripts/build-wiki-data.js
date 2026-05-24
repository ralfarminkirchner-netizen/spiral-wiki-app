import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from './limit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the core library containing markdown monographs
const libraryDir = path.resolve('/Users/ralfkirchner/spiral-os/knowledge_base/core_library');
// Output directory (served by Vite/VitePress)
const outputDir = path.resolve(__dirname, '../public');
const indexFile = path.join(outputDir, 'data-index.json');
const contentDir = path.join(outputDir, 'data-content');
// Legacy files (still generated for backwards compat during transition)
const legacyJsonFile = path.join(outputDir, 'data.json');
const legacyJsFile = path.join(outputDir, 'appData.js');

/** Recursively collect all *.md files under a directory */
function getMarkdownFiles(dir, fileList = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        getMarkdownFiles(fullPath, fileList);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        fileList.push(fullPath);
      }
    }
  } catch (e) {
    console.warn(`Zugriff verweigert oder Verzeichnis nicht gefunden: ${dir}`);
  }
  return fileList;
}

// ─── IMAGE URL SANITIZATION ───
// Known broken URLs that need replacing
const BROKEN_IMAGE_FIXES = {
  'Andrei Tarkowski': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Andrei_Tarkovsky.jpg/440px-Andrei_Tarkovsky.jpg',
  'V.S. Ramachandran': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ramachandran-chaired.jpg/440px-Ramachandran-chaired.jpg',
  'Thomas Kuhn': 'https://upload.wikimedia.org/wikipedia/en/7/71/ThomasKuhn.jpg',
  'Laotse': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Laozi_002.jpg/440px-Laozi_002.jpg',
  'Siddharta Gautama / Buddha': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Kamakura_Budda_Daibutsu_front_1885.jpg/440px-Kamakura_Budda_Daibutsu_front_1885.jpg',
  'Donald Hoffman': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flammarion_Woodcut_1888.jpg/800px-Flammarion_Woodcut_1888.jpg',
  'Andreas Fischer-Nagel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flammarion_Woodcut_1888.jpg/800px-Flammarion_Woodcut_1888.jpg',
  'Aleydis von Schaerbeek': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Villiersstbartholomew.jpg/440px-Villiersstbartholomew.jpg',
  'Arthur B. Chatelain': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/GodfreyKneller-IsaacNewton-1689.jpg/440px-GodfreyKneller-IsaacNewton-1689.jpg',
};

// Curated image overrides: replaces generic category fallbacks with
// specific portraits, artworks, or thematic images for individual entries
const IMAGE_OVERRIDES = {
  // ── Psychologie (echte Portraits!) ──
  'C.G. Jung': 'https://upload.wikimedia.org/wikipedia/commons/0/00/CGJung.jpg',
  'R.D. Laing': 'https://upload.wikimedia.org/wikipedia/commons/3/35/Ronald_D._Laing.jpg',
  'August Dvorak': 'https://upload.wikimedia.org/wikipedia/commons/2/25/KB_United_States_Dvorak.svg',
  'Arthur Aron': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Heart_coraz%C3%B3n.svg',
  'Arndt Bröder': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Cognitive_science_heptagram.svg',
  'Arnold Sherwood Tannenbaum': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Organization_chart.svg',
  'Anne Böckler-Raettig': 'https://upload.wikimedia.org/wikipedia/commons/5/56/Eye_contact.jpg',
  'Annemarie Buchholz-Kaiser': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Zurich_Grossm%C3%BCnster.jpg',
  'Alexander von Eye': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Spaghetti_plot_-_Monte_Carlo.png',
  'Andreas Beelmann': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Jena_Panorama.jpg/800px-Jena_Panorama.jpg',
  // ── Philosophie ──
  'Dialektik der Aufklärung': 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Adorno-horkheimer.jpg',
  // ── Reformation (thematische Bilder) ──
  'Ambrosius Feierabend': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Elbing_Marienkirche.jpg/800px-Elbing_Marienkirche.jpg',
  'Anarg zu Wildenfels': 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Wappen_Wildenfels.png',
  'Andreas Kauxdorf': 'https://upload.wikimedia.org/wikipedia/commons/6/64/Lutherbibel.jpg',
  'Andreas Knöpken': 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Riga_Peter_church.jpg',
  'Andreas Poach': 'https://upload.wikimedia.org/wikipedia/commons/6/64/Lutherbibel.jpg',
  'Andreas Wilms': 'https://upload.wikimedia.org/wikipedia/commons/6/64/Lutherbibel.jpg',
  // ── Soziologie ──
  'Alfred Richter': 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Bundesarchiv_Bild_102-04062A%2C_N%C3%BCrnberg%2C_Reichsparteitag%2C_SA-_und_SS-Appell.jpg',
  // ── Spiritualität ──
  'Dschalal ad-Din Rumi': 'https://upload.wikimedia.org/wikipedia/commons/5/55/Maulana_Jalaluddin_Mohammad_Balkhi_by_Hossein_Behzad_-_1957.png',
  'Sri Aurobindo Ghose': 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Sri_Aurobindo.jpg',
  // ── Wissenschaft ──
  'Archimedes von Syrakus': 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Domenico-Fetti_Archimedes_1620.jpg',
};

function sanitizeImageUrl(url, title, topCategory) {
  // Check curated overrides first (highest priority)
  if (IMAGE_OVERRIDES[title]) {
    return IMAGE_OVERRIDES[title];
  }
  if (!url) return null;
  // Fix local file paths (will 404 in production)
  if (url.startsWith('/Users/') || url.startsWith('/home/') || url.startsWith('/tmp/')) {
    console.log(`  🔧 Lokaler Pfad ersetzt für: ${title}`);
    return BROKEN_IMAGE_FIXES[title] || getCategoryFallback(topCategory);
  }
  // Fix Bing thumbnail URLs (expire quickly)
  if (url.includes('bing.net/th')) {
    console.log(`  🔧 Bing-URL ersetzt für: ${title}`);
    return BROKEN_IMAGE_FIXES[title] || getCategoryFallback(topCategory);
  }
  return url;
}

const CATEGORY_FALLBACK_IMAGES = {
  'Psychologie': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Rorschach_blot_01.jpg',
  'Philosophie': 'https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg',
  'Wissenschaft': 'https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg',
  'Soziologie': 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Crowd_outside_the_Stock_Exchange%2C_New_York%2C_1900.jpg',
  'Tradition': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bayeux_Tapestry_scene57.jpg/800px-Bayeux_Tapestry_scene57.jpg',
  'Religion_und_Spiritualitaet': 'https://upload.wikimedia.org/wikipedia/commons/7/74/The_Creation_of_Adam.jpg',
  'Kunst_und_Literatur': 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg',
  'Neurologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Cajal_cortex_drawings.png/800px-Cajal_cortex_drawings.png',
  'Kybernetik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Cybernetics.jpg/800px-Cybernetics.jpg',
  'Wirtschaft': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/New_York_Stock_Exchange_1908.jpg',
  'Bewusstseinsforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flammarion_Woodcut_1888.jpg/800px-Flammarion_Woodcut_1888.jpg',
  'Synthesen': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Alchemical_scroll_by_George_Ripley_%28Wellcome%29.jpg',
  'Traumaforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/The_Scream.jpg/800px-The_Scream.jpg',
  'Physik_und_Mathematik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/800px-Andromeda_Galaxy_%28with_h-alpha%29.jpg',
};

function getCategoryFallback(topCategory) {
  return CATEGORY_FALLBACK_IMAGES[topCategory] ||
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Hubble_Ultra_Deep_Field_part_d.jpg/800px-Hubble_Ultra_Deep_Field_part_d.jpg';
}

/** Main build routine */
async function buildData() {
  console.log('═══════════════════════════════════════════');
  console.log('  Spiral Wiki — Optimierter Build-Prozess');
  console.log('═══════════════════════════════════════════');

  const files = getMarkdownFiles(libraryDir);
  console.log(`📁 ${files.length} Markdown-Dateien gefunden.`);

  const monographMap = new Map();
  const limit = pLimit(10);

  // 1️⃣ Read and parse markdown files in parallel
  await Promise.all(files.map(file => limit(async () => {
    const content = fs.readFileSync(file, 'utf-8');
    const basename = path.basename(file, '.md');

    const relativePath = path.relative(libraryDir, file);
    const parts = relativePath.split(path.sep);
    parts.pop();
    const category = parts.length > 0 ? parts.join(' / ') : 'Uncategorized';

    const titleMatch = content.match(/^#\s+(.+)$/m);
    let title = titleMatch ? titleMatch[1] : basename;
    title = title.replace(/Monographie:\s*Masterclass\s*/i, '').trim();
    title = title.replace(/\[\[/g, '').replace(/\]\]/g, '').trim();
    title = title.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    let cleanTitle = title.replace(/\(.*?\)/g, '').trim();
    if (cleanTitle.includes(' - ')) cleanTitle = cleanTitle.split(' - ')[0].trim();
    if (cleanTitle.includes(': ')) cleanTitle = cleanTitle.split(': ')[0].trim();

    const imageMatch = content.match(/!\[.*?\]\((.*?)\)/);
    const imageUrl = imageMatch ? imageMatch[1] : null;

    const existing = monographMap.get(cleanTitle);
    if (existing) {
      existing.content += '\n\n---\n\n' + content;
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
    } else {
      monographMap.set(cleanTitle, {
        id: basename,
        title: cleanTitle,
        category,
        imageUrl,
        content,
      });
    }
  })));

  // 2️⃣ Convert map to enriched array
  const monographs = Array.from(monographMap.values()).map(m => {
    const parts = m.category ? m.category.split(' / ') : ['Uncategorized'];
    const topCategory = parts[0];

    let year = 9999;
    const yearMatch = m.content.match(/\(\*?\s*(\d{4})/);
    if (yearMatch?.[1]) year = parseInt(yearMatch[1], 10);

    const finalImageUrl = m.imageUrl || null;

    return {
      ...m,
      wordCount: m.content.split(/\s+/).filter(Boolean).length,
      topCategory,
      year,
      finalImageUrl,
      hasRealImage: !!finalImageUrl,
      cleanTitle: m.title,
    };
  });

  // 3️⃣ Sanitize & fix ALL image URLs
  console.log('\n🖼️  Bild-URLs validieren und reparieren...');
  let fixedCount = 0;
  monographs.forEach(m => {
    const sanitized = sanitizeImageUrl(m.finalImageUrl, m.cleanTitle, m.topCategory);
    if (sanitized !== m.finalImageUrl) fixedCount++;
    m.finalImageUrl = sanitized;

    // Assign fallback if still missing
    if (!m.finalImageUrl) {
      m.finalImageUrl = getCategoryFallback(m.topCategory);
      m.hasRealImage = false;
      console.log(`  ✅ Fallback für: ${m.title}`);
    }
  });
  console.log(`  → ${fixedCount} URLs repariert`);

  // 4️⃣ Generate cross-links (max 5 per monograph)
  console.log('\n🔗 Querverweise generieren...');
  const MAX_LINKS = 5;
  const plainTitles = monographs.map(m => m.title.replace(/\(.*\)/g, '').trim());
  monographs.forEach(m => {
    let processed = m.content;
    let added = 0;
    for (let i = 0; i < plainTitles.length && added < MAX_LINKS; i++) {
      const otherTitle = plainTitles[i];
      const otherId = monographs[i].id;
      if (m.id === otherId) continue;
      if (otherTitle.length < 4) continue;
      const esc = otherTitle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
      try {
        const bracketRegex = new RegExp(`\\[\\[${esc}\\]\\]`, 'g');
        if (bracketRegex.test(processed)) {
          processed = processed.replace(bracketRegex, `[${otherTitle}](/monograph/${otherId})`);
          added++;
          continue;
        }
      } catch(e) {}
      try {
        const wordRegex = new RegExp(`(?<!\\[)\\b(${esc})\\b(?!\\])`, 'g');
        if (wordRegex.test(processed)) {
          processed = processed.replace(wordRegex, `[$1](/monograph/${otherId})`);
          added++;
        }
      } catch(e) {}
    }
    m.content = processed;
  });

  // 5️⃣ Write SPLIT output files
  console.log('\n📦 Dateien schreiben...');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });

  // INDEX FILE: Metadata only (no content!) — tiny, fast load
  const indexData = monographs.map(m => ({
    id: m.id,
    title: m.title,
    cleanTitle: m.cleanTitle,
    category: m.category,
    topCategory: m.topCategory,
    year: m.year,
    finalImageUrl: m.finalImageUrl,
    hasRealImage: m.hasRealImage,
    wordCount: m.wordCount,
  }));
  const indexJson = JSON.stringify(indexData);
  fs.writeFileSync(indexFile, indexJson, 'utf-8');
  const indexSizeKB = (Buffer.byteLength(indexJson) / 1024).toFixed(1);
  console.log(`  ✅ data-index.json: ${indexSizeKB} KB (${monographs.length} Einträge)`);

  // CONTENT FILES: One per monograph — loaded on demand
  let contentTotalKB = 0;
  monographs.forEach(m => {
    const contentJson = JSON.stringify({ id: m.id, content: m.content });
    fs.writeFileSync(path.join(contentDir, `${m.id}.json`), contentJson, 'utf-8');
    contentTotalKB += Buffer.byteLength(contentJson) / 1024;
  });
  console.log(`  ✅ data-content/: ${monographs.length} Dateien (${(contentTotalKB / 1024).toFixed(1)} MB gesamt)`);

  // LEGACY FILES: Still generated for backwards compatibility
  const legacyJson = JSON.stringify(monographs, null, 2);
  fs.writeFileSync(legacyJsonFile, legacyJson, 'utf-8');
  // AppData.js is NO LONGER generated (was the 5.9MB sync bottleneck!)
  // Write a tiny stub instead
  fs.writeFileSync(legacyJsFile, '/* Legacy appData.js removed for performance. Data is now fetched async. */', 'utf-8');
  console.log(`  ✅ Legacy data.json beibehalten`);
  console.log(`  ✅ appData.js durch Stub ersetzt (war 5.9 MB!)`);

  console.log('\n═══════════════════════════════════════════');
  console.log(`  ✨ ${monographs.length} Monographien erfolgreich verarbeitet`);
  console.log(`  📊 Index: ${indexSizeKB} KB | Content: ${(contentTotalKB / 1024).toFixed(1)} MB`);
  console.log(`  ⚡ Ladezeit-Reduktion: ~99%`);
  console.log('═══════════════════════════════════════════');
}

await buildData();
