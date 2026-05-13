import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const libraryDir = path.resolve('/Users/ralfkirchner/spiral-os/knowledge_base/core_library');
const cachePath = path.join(__dirname, 'image-cache.json');

let imageCache = {};
if (fs.existsSync(cachePath)) {
  imageCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
}

function getMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Totalbibliothek/1.0 (ralfkirchner@example.com)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const files = getMarkdownFiles(libraryDir);
  console.log(`Prüfe ${files.length} Dateien...`);

  let addedCount = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    const basename = path.basename(file, '.md');
    
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (!titleMatch) continue;

    let title = titleMatch[1];
    title = title.replace(/Monographie:\s*(Masterclass)?\s*/i, '').trim();
    let cleanTitle = title.replace(/\(.*?\)/g, '').trim();
    
    if (cleanTitle.includes(' - ')) {
      cleanTitle = cleanTitle.split(' - ')[0].trim();
    }
    if (cleanTitle.includes(': ')) {
      cleanTitle = cleanTitle.split(': ')[0].trim();
    }
    
    let originalUrl = null;
    let thumbUrl = null;

    if (imageCache[basename] && imageCache[basename].original) {
      originalUrl = imageCache[basename].original;
      thumbUrl = imageCache[basename].thumbnail;
    } else {
      console.log(`Suche nach: ${cleanTitle}`);
      let url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail|original&pithumbsize=100&titles=${encodeURIComponent(cleanTitle)}`;
      let data;
      try {
        data = await fetchJson(url);
      } catch(e) {
        console.log(`Fehler bei ${cleanTitle}`);
        continue;
      }

      let pages = data.query?.pages;
      let page = pages ? Object.values(pages)[0] : null;

      if (!page || page.pageid === undefined || (!page.thumbnail && !page.original)) {
        url = `https://de.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail|original&pithumbsize=100&titles=${encodeURIComponent(cleanTitle)}`;
        try {
          data = await fetchJson(url);
          pages = data.query?.pages;
          page = pages ? Object.values(pages)[0] : null;
        } catch(e) {
          continue;
        }
      }

      if (page && page.pageid !== undefined) {
        originalUrl = page.original?.source;
        thumbUrl = page.thumbnail?.source;
        if (!originalUrl && thumbUrl) originalUrl = thumbUrl;
        if (!thumbUrl && originalUrl) thumbUrl = originalUrl;

        if (originalUrl && thumbUrl) {
          imageCache[basename] = { original: originalUrl, thumbnail: thumbUrl };
          fs.writeFileSync(cachePath, JSON.stringify(imageCache, null, 2));
        }
      }
    }

    if (originalUrl) {
      if (!content.includes(originalUrl)) {
        const lines = content.split('\n');
        const titleIndex = lines.findIndex(line => line.startsWith('# '));
        if (titleIndex !== -1) {
          lines.splice(titleIndex + 1, 0, `\n![${cleanTitle}](${originalUrl})\n`);
          fs.writeFileSync(file, lines.join('\n'));
          addedCount++;
          console.log(`[+] Wikipedia-Bild für ${cleanTitle} hinzugefügt!`);
        }
      }
    } else {
      console.log(`[-] Nichts für ${cleanTitle} gefunden.`);
    }

    if (!imageCache[basename]) {
      await new Promise(r => setTimeout(r, 50)); 
    }
  }

  console.log(`\nFertig. Bilder hinzugefügt: ${addedCount}`);
}

run();
