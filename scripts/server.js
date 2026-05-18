import http from 'http';
import fs from 'fs';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      fs.writeFileSync('scripts/fetched-images.json', body);
      res.writeHead(200);
      res.end('OK');
      console.log('Saved fetched-images.json');
      process.exit(0);
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3334, () => console.log('Server listening on 3334'));
