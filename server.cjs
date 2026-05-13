const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((request, response) => {
  let filePath = request.url === '/' ? '/index.html' : request.url;
  filePath = filePath.split('?')[0];
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  const absolutePath = path.join(PUBLIC_DIR, filePath);

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        response.writeHead(404);
        response.end('File not found');
      } else {
        response.writeHead(500);
        response.end('Server error: ' + error.code);
      }
    } else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
