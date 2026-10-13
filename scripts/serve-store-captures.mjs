import http from 'node:http';
import { readFile } from 'node:fs/promises';
const documentBytes = await readFile(new URL('../../releases/itch/capture/index.html', import.meta.url));
http.createServer(function serveCapture(request, response) {
  response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  response.end(documentBytes);
}).listen(5199, '127.0.0.1', function ready() {console.log('Store capture page: http://127.0.0.1:5199');});
