'use strict';
/* Server static minimal pentru teste și dezvoltare: node tests/serve.js [dir] [port] */
const http = require('http'), fs = require('fs'), path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve(dir, port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(dir, path.normalize(p));
    if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
  });
  return new Promise(r => srv.listen(port || 0, '127.0.0.1', () => r(srv)));
}
module.exports = { serve };
if (require.main === module) serve(path.resolve(process.argv[2] || path.join(__dirname, '..')), +process.argv[3] || 8080).then(s => console.log('http://127.0.0.1:' + s.address().port + '/'));
