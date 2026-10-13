// Serves dist/ over HTTPS the way GitHub Pages does, for the e2e suite:
// - HTTPS, because the CSP carries upgrade-insecure-requests and WebKit applies it to
//   http://localhost too (every script would be upgraded and fail);
// - /dir -> 301 /dir/ with the query string kept (Stripe returns to /support/thanks?type=...);
// - unknown paths get dist/404.html with status 404.
// Usage: node e2e/serve.mjs [port] [dir]. The self-signed cert is made with openssl at start.
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2] || 4322);
const root = resolve(process.argv[3] || 'dist');

const certDir = mkdtempSync(join(tmpdir(), 'aa-e2e-cert-'));
execFileSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=localhost',
  '-keyout', join(certDir, 'key.pem'), '-out', join(certDir, 'cert.pem'),
], { stdio: 'ignore' });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

const kind = (p) => { try { return statSync(p).isDirectory() ? 'dir' : 'file'; } catch { return null; } };

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
}

createServer({ key: readFileSync(join(certDir, 'key.pem')), cert: readFileSync(join(certDir, 'cert.pem')) }, (req, res) => {
  const url = new URL(req.url, `https://localhost:${port}`);
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { path = '/'; }
  const target = normalize(join(root, path));
  if (!target.startsWith(root)) return send(res, 404, join(root, '404.html'));
  const k = kind(target);
  if (k === 'dir' && !path.endsWith('/')) {
    res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
    return res.end();
  }
  if (k === 'dir' && kind(join(target, 'index.html')) === 'file') return send(res, 200, join(target, 'index.html'));
  if (k === 'file') return send(res, 200, target);
  return send(res, 404, join(root, '404.html'));
}).listen(port, () => console.log(`serving ${root} on https://localhost:${port}`));
