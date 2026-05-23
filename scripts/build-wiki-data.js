import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchImageWithFallback } from './image-fetcher.js';
import pLimit from './limit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the core library containing markdown monographs
const libraryDir = path.resolve('/Users/ralfkirchner/spiral-os/knowledge_base/core_library');
// Output directory (served by Vite/VitePress)
const outputDir = path.resolve(__dirname, '../public');
const outputFileJson = path.join(outputDir, 'data.json');
const outputFileJs = path.join(outputDir, 'appData.js');

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

/** Main build routine */
async function buildData() {
  console.log('Starte Build-Prozess für die Spiral Wiki App...');
  const files = getMarkdownFiles(libraryDir);
  console.log(`${files.length} Markdown-Dateien gefunden.`);

  const monographMap = new Map();
  const limit = pLimit(10); // limit concurrent file reads

  // 1️⃣ Read and parse markdown files in parallel
  await Promise.all(files.map(file => limit(async () => {
    const content = fs.readFileSync(file, 'utf-8');
    const basename = path.basename(file, '.md');

    // Extract category hierarchy from the folder structure
    const relativePath = path.relative(libraryDir, file);
    const parts = relativePath.split(path.sep);
    parts.pop(); // drop the file name
    const category = parts.length > 0 ? parts.join(' / ') : 'Uncategorized';

    // Parse title (first line beginning with #)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    let title = titleMatch ? titleMatch[1] : basename;
    // Normalise title for deduplication
    title = title.replace(/Monographie:\s*Masterclass\s*/i, '').trim();
    title = title.replace(/\[\[/g, '').replace(/\]\]/g, '').trim();
    title = title.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    let cleanTitle = title.replace(/\(.*?\)/g, '').trim();
    if (cleanTitle.includes(' - ')) cleanTitle = cleanTitle.split(' - ')[0].trim();
    if (cleanTitle.includes(': ')) cleanTitle = cleanTitle.split(': ')[0].trim();

    // Extract first image markdown if present
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

  // 2️⃣ Convert map to enriched array (metadata, word count, timestamp, precomputed frontend fields)
  const monographs = Array.from(monographMap.values()).map(m => {
    // Determine topCategory
    const parts = m.category ? m.category.split(' / ') : ['Uncategorized'];
    const topCategory = parts[0];

    // Determine year
    let year = 9999;
    const yearMatch = m.content.match(/\(\*?\s*(\d{4})/);
    if (yearMatch?.[1]) year = parseInt(yearMatch[1], 10);

    // Final Image URL will be finalized in step 3, but initialize it here
    const finalImageUrl = m.imageUrl || null;

    return {
      ...m,
      wordCount: m.content.split(/\s+/).filter(Boolean).length,
      lastModified: new Date().toISOString(),
      topCategory,
      year,
      finalImageUrl,
      hasRealImage: !!finalImageUrl,
      cleanTitle: m.title
    };
  });

  // 3️⃣ Assign deterministic fallback images for any missing images
  console.log('Fetching fehlende Bilder (Wikipedia → Bing fallback)...');
  const categoryImages = {
    'Psychologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Artificial_neural_network.svg/800px-Artificial_neural_network.svg.png',
    'Philosophie': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/The_School_of_Athens_by_Raffaello_Sanzio_da_Urbino.jpg',
    'Wissenschaft': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Hubble_Ultra_Deep_Field_High-res.jpg/800px-Hubble_Ultra_Deep_Field_High-res.jpg',
    'Soziologie': 'https://upload.wikimedia.org/wikipedia/commons/4/41/Global_network.jpg',
    'Tradition': 'https://upload.wikimedia.org/wikipedia/commons/6/63/Flammarion.jpg',
    'Religion_und_Spiritualitaet': 'https://upload.wikimedia.org/wikipedia/commons/6/63/Flammarion.jpg',
    'Kunst_und_Literatur': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/800px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    'Neurologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Human_brain_NIH.png/800px-Human_brain_NIH.png',
    'Kybernetik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Internet_map_1024.png/800px-Internet_map_1024.png',
    'Wirtschaft': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/NYSE_floor.jpg/800px-NYSE_floor.jpg',
    'Bewusstseinsforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Consciousness.jpg/800px-Consciousness.jpg',
    'Synthesen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Network_Representation.svg/800px-Network_Representation.svg.png',
    'Traumaforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Human_brain_NIH.png/800px-Human_brain_NIH.png'
  };
  
  const defaults = [
    'https://upload.wikimedia.org/wikipedia/commons/6/63/Flammarion.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Hubble_Ultra_Deep_Field_High-res.jpg/800px-Hubble_Ultra_Deep_Field_High-res.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/b/bc/The_School_of_Athens_by_Raffaello_Sanzio_da_Urbino.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Internet_map_1024.png/800px-Internet_map_1024.png'
  ];

  monographs.forEach(m => {
    if (!m.finalImageUrl) {
      const charCode = m.id.charCodeAt(0) + m.id.charCodeAt(m.id.length - 1);
      const topCat = m.category.split(' / ')[0];
      const fallbackList = categoryImages[topCat] ? [categoryImages[topCat]] : defaults;
      m.finalImageUrl = fallbackList[charCode % fallbackList.length];
      console.log(`  ✅ Fallback assigned to: ${m.title}`);
    }
  });

  // 4️⃣ Generate cross‑links (max 5 per monograph to keep UI tidy)
  console.log('Generiere Querverweise...');
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

  // 5️⃣ Write results to the public folder
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const json = JSON.stringify(monographs, null, 2);
  fs.writeFileSync(outputFileJson, json, 'utf-8');
  fs.writeFileSync(outputFileJs, `const windowWikiData = ${json};`, 'utf-8');
  console.log(`Erfolgreich ${monographs.length} Monographien geschrieben.`);
}

await buildData();
