import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

const cacheFile = path.resolve('./cache/imageCache.json');
let cache = {};
try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch (_) { /* ignore */ }

export async function fetchWikiImage(title) {
  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const data = await response.json();
    return data.originalimage?.source || null;
  } catch { return null; }
}

export async function fetchBingImage(title) {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) return null;
  const endpoint = `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(title)}&count=1`;
  try {
    const res = await fetch(endpoint, { headers: { 'Ocp-Apim-Subscription-Key': apiKey } });
    const json = await res.json();
    return json.value?.[0]?.contentUrl || null;
  } catch { return null; }
}

export async function fetchImageWithFallback(title) {
  if (cache[title]) return cache[title];
  let url = await fetchWikiImage(title);
  if (!url) url = await fetchBingImage(title);
  cache[title] = url;
  // Persist cache asynchronously
  fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), () => {});
  return url;
}
