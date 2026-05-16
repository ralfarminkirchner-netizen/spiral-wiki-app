import fs from 'fs';
import path from 'path';

const cacheDir = path.resolve('./cache');
const cacheFile = path.join(cacheDir, 'imageCache.json');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
let cache = {};
try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch (_) { /* ignore */ }

function saveCache() {
  fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), () => {});
}

/** 1️⃣ English Wikipedia REST API */
async function fetchWikiImage(title) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.originalimage?.source || data.thumbnail?.source || null;
  } catch { return null; }
}

/** 2️⃣ German Wikipedia REST API (many entries are German scholars) */
async function fetchDeWikiImage(title) {
  try {
    const res = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.originalimage?.source || data.thumbnail?.source || null;
  } catch { return null; }
}

/** 3️⃣ Wikidata: search by label, get P18 (image) claim */
async function fetchWikidataImage(title) {
  try {
    // Search for entity
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(title)}&language=de&format=json&limit=1`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const entityId = searchData.search?.[0]?.id;
    if (!entityId) return null;

    // Get entity claims
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${entityId}&property=P18&format=json`;
    const entityRes = await fetch(entityUrl);
    if (!entityRes.ok) return null;
    const entityData = await entityRes.json();
    const imageName = entityData.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!imageName) return null;

    // Convert filename to Commons URL
    const md5 = await import('crypto').then(c => c.createHash('md5').update(imageName.replace(/ /g, '_')).digest('hex'));
    return `https://upload.wikimedia.org/wikipedia/commons/${md5[0]}/${md5.slice(0, 2)}/${encodeURIComponent(imageName.replace(/ /g, '_'))}`;
  } catch { return null; }
}

/** 4️⃣ Wikipedia HTML scraping — parse the actual article page for og:image */
async function fetchWikiOgImage(title) {
  try {
    // Try German Wikipedia first (many entries are German)
    for (const lang of ['de', 'en']) {
      const res = await fetch(`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, {
        headers: { 'User-Agent': 'SpiralMindWiki/1.0' }
      });
      if (!res.ok) continue;
      const html = await res.text();
      // Look for og:image meta tag
      const ogMatch = html.match(/<meta property="og:image"\s+content="([^"]+)"/);
      if (ogMatch && ogMatch[1] && !ogMatch[1].includes('placeholder')) {
        return ogMatch[1];
      }
    }
    return null;
  } catch { return null; }
}

/** 5️⃣ Bing Image Search (requires BING_API_KEY) */
async function fetchBingImage(title) {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(title + ' portrait')}&count=1&safeSearch=Strict`,
      { headers: { 'Ocp-Apim-Subscription-Key': apiKey } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.value?.[0]?.contentUrl || null;
  } catch { return null; }
}

/**
 * Multi-source image fetcher with aggressive caching.
 * Cascade: EN Wiki → DE Wiki → Wikidata → Wiki OG → Bing
 */
export async function fetchImageWithFallback(title) {
  if (cache[title] !== undefined) return cache[title];

  const sources = [
    { name: 'EN Wikipedia', fn: () => fetchWikiImage(title) },
    { name: 'DE Wikipedia', fn: () => fetchDeWikiImage(title) },
    { name: 'Wikidata P18', fn: () => fetchWikidataImage(title) },
    { name: 'Wiki OG:Image', fn: () => fetchWikiOgImage(title) },
    { name: 'Bing Search', fn: () => fetchBingImage(title) },
  ];

  for (const source of sources) {
    try {
      const url = await source.fn();
      if (url) {
        console.log(`  ✅ ${title} → ${source.name}`);
        cache[title] = url;
        saveCache();
        return url;
      }
    } catch { /* try next */ }
  }

  console.log(`  ❌ ${title} → kein Bild gefunden`);
  cache[title] = null;
  saveCache();
  return null;
}
