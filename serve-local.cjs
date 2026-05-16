/**
 * Zero-dependency local server for SPiRAL MiND WiKi
 * Serves the built dist/ folder with SPA fallback for React Router
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const DIST_DIR = path.join(__dirname, 'dist');
const PUBLIC_DIR = path.join(__dirname, 'public');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function tryServeFile(filePath, response) {
  return new Promise((resolve) => {
    fs.readFile(filePath, (error, content) => {
      if (error) {
        resolve(false);
      } else {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': contentType });
        response.end(content);
        resolve(true);
      }
    });
  });
}

const server = http.createServer(async (request, response) => {
  let urlPath = request.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  // 1. Try dist/ first
  const distPath = path.join(DIST_DIR, urlPath);
  if (await tryServeFile(distPath, response)) return;

  // 2. Try public/ (for data.json, appData.js, etc.)
  const publicPath = path.join(PUBLIC_DIR, urlPath);
  if (await tryServeFile(publicPath, response)) return;

  // 3. SPA fallback — serve index.html for any unmatched route (React Router)
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (await tryServeFile(indexPath, response)) return;

  response.writeHead(404);
  response.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ✨ SPiRAL MiND WiKi läuft auf: http://localhost:${PORT}\n`);
});
