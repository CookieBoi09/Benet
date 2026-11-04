import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + '/') || !['/index.html','/src/app.js','/src/model.js','/src/style.css'].includes(pathname === '/' ? '/index.html' : pathname)) { res.writeHead(404); return res.end('Not found'); }
  try { const body = await readFile(file); res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]); res.end(body); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Benet listening on port ' + (process.env.PORT || 3000)));
