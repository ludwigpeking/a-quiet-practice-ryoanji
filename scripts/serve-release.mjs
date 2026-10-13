import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'three/addons/libs/fflate.module.js';

const releaseDirectory = new URL('../../releases/itch/A Quiet Practice/', import.meta.url);
const wallpaperArchive = unzipSync(await readFile(new URL('a-quiet-practice-wallpaper.zip', releaseDirectory)));
http.createServer(async function serveRelease(request, response) {
  if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(request.url === '/wallpaper' ? wallpaperArchive['index.html'] : await readFile(new URL('index.html', releaseDirectory)));
}).listen(5199, '127.0.0.1', function ready() { console.log('Release preview: http://127.0.0.1:5199/'); });
