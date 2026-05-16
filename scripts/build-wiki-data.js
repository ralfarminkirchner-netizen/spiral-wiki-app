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

  // 2️⃣ Convert map to enriched array (metadata, word count, timestamp)
  const monographs = Array.from(monographMap.values()).map(m => ({
    ...m,
    wordCount: m.content.split(/\s+/).filter(Boolean).length,
    lastModified: new Date().toISOString(),
  }));

  // 3️⃣ Fetch missing images using Wikipedia → Bing fallback, limited concurrency
  console.log('Fetching fehlende Bilder (Wikipedia → Bing fallback)...');
  await Promise.all(monographs.map(m => limit(async () => {
    if (!m.imageUrl) {
      m.imageUrl = await fetchImageWithFallback(m.title);
    }
  })));

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
      const bracketRegex = new RegExp(`\\\\[\\\\[${esc}\\\\]\\\\]`, 'g');
      if (bracketRegex.test(processed)) {
        processed = processed.replace(bracketRegex, `[${otherTitle}](/monograph/${otherId})`);
        added++;
        continue;
      }
      const wordRegex = new RegExp(`(?<!\\\\[)\\\\b(${esc})\\\\b(?!\\\\])`, 'g');
      if (wordRegex.test(processed)) {
        processed = processed.replace(wordRegex, `[$1](/monograph/${otherId})`);
        added++;
      }
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
