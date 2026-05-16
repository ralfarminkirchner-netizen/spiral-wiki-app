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

async function fetchBingImage(query) {
  return new Promise((resolve) => {
    https.get(`https://www.bing.com/images/search?q=${encodeURIComponent(query + " person")}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Find Microsoft's own cached thumbnail URLs which never have hotlink protection!
        const match = data.match(/(https:\/\/tse\d+\.mm\.bing\.net\/th\?id=[a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          resolve(match[1]);
        } else {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function searchWikiCanonicalTitle(query, lang = 'en') {
  let searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=1`;
  try {
    let searchData = await fetchJson(searchUrl);
    if (searchData.query?.search?.length > 0) {
      return searchData.query.search[0].title;
    }
  } catch(e) {}
  return null;
}

async function fetchWikiImageForTitle(title, lang = 'en') {
  let url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(title)}`;
  try {
    let data = await fetchJson(url);
    let pages = data.query?.pages;
    let page = pages ? Object.values(pages)[0] : null;
    if (page && page.original) return page.original.source;
  } catch(e) {}
  return null;
}

async function run() {
  const files = getMarkdownFiles(libraryDir);
  console.log(`Prüfe ${files.length} Dateien auf fehlende Bilder...`);

  let addedCount = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    const basename = path.basename(file, '.md');
    
    // Check if the file already has an image
    const existingImageMatch = content.match(/!\[.*?\]\((.*?)\)/);
    if (existingImageMatch) {
      continue; // Skip files that ALREADY have an image!
    }

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
    
    let finalUrl = null;

    if (imageCache[basename] && imageCache[basename].original) {
      finalUrl = imageCache[basename].original;
    } else {
      console.log(`\nSuche nach Bild für: ${cleanTitle}`);
      
      // 1. Try Exact Wikipedia EN
      finalUrl = await fetchWikiImageForTitle(cleanTitle, 'en');
      
      // 2. Try Exact Wikipedia DE
      if (!finalUrl) finalUrl = await fetchWikiImageForTitle(cleanTitle, 'de');

      // 3. Try Search Wikipedia EN (resolves typos and middle names)
      if (!finalUrl) {
        let canonicalTitle = await searchWikiCanonicalTitle(cleanTitle, 'en');
        if (canonicalTitle) finalUrl = await fetchWikiImageForTitle(canonicalTitle, 'en');
      }

      // 4. Try Search Wikipedia DE
      if (!finalUrl) {
        let canonicalTitle = await searchWikiCanonicalTitle(cleanTitle, 'de');
        if (canonicalTitle) finalUrl = await fetchWikiImageForTitle(canonicalTitle, 'de');
      }

      // 5. Try Bing Images Scraper (The Ultimate Fallback for Obscure Entries)
      if (!finalUrl) {
        console.log(`-> Wikipedia gescheitert. Suche in Bing Images...`);
        finalUrl = await fetchBingImage(cleanTitle);
      }

      if (finalUrl) {
        imageCache[basename] = { original: finalUrl, thumbnail: finalUrl };
        fs.writeFileSync(cachePath, JSON.stringify(imageCache, null, 2));
      }
    }

    if (finalUrl) {
      if (!content.includes(finalUrl)) {
        const lines = content.split('\n');
        const titleIndex = lines.findIndex(line => line.startsWith('# '));
        if (titleIndex !== -1) {
          lines.splice(titleIndex + 1, 0, `\n![${cleanTitle}](${finalUrl})\n`);
          fs.writeFileSync(file, lines.join('\n'));
          addedCount++;
          console.log(`[+] Bild für ${cleanTitle} hinzugefügt: ${finalUrl}`);
        }
      }
    } else {
      console.log(`[-] Komplett gescheitert für ${cleanTitle}. Nichts gefunden.`);
    }

    if (!imageCache[basename]) {
      await new Promise(r => setTimeout(r, 100)); // Be polite to APIs
    }
  }

  console.log(`\nFertig. Bilder hinzugefügt: ${addedCount}`);
}

run();
