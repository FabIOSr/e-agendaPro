import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = 3000;

const REWRITES = {
  '/': '/pages/landing-page.html',
  '/auth': '/pages/auth.html',
  '/onboarding': '/pages/onboarding.html',
  '/painel': '/pages/painel.html',
  '/planos': '/pages/planos.html',
  '/clientes': '/pages/clientes.html',
  '/relatorio': '/pages/relatorio.html',
  '/configuracoes': '/pages/configuracoes.html',
  '/cancelar': '/pages/cancelar-cliente.html',
  '/cancelar-cliente': '/pages/cancelar-cliente.html',
  '/reagendar': '/pages/reagendar-cliente.html',
  '/reagendar-cliente': '/pages/reagendar-cliente.html',
  '/avaliar': '/pages/avaliar-cliente.html',
  '/avaliar-cliente': '/pages/avaliar-cliente.html',
  '/confirmar-reserva': '/pages/confirmar-reserva.html',
  '/admin/login': '/pages/admin/login.html',
  '/admin/dashboard': '/pages/admin/dashboard.html',
  '/admin/profissionais': '/pages/admin/profissionais.html',
  '/admin/financeiro': '/pages/admin/financeiro.html',
  '/admin/acoes': '/pages/admin/acoes.html',
  '/admin/configuracoes': '/pages/admin/configuracoes.html',
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function resolvePath(urlPath) {
  // Check exact rewrites first
  if (REWRITES[urlPath]) {
    return path.join(DIST_DIR, REWRITES[urlPath]);
  }

  // Check slug pattern (e.g., /ana-cabelos)
  if (urlPath.startsWith('/') && urlPath.split('/').length === 2 && urlPath !== '/') {
    const slugPath = path.join(DIST_DIR, '/pages/pagina-cliente.html');
    if (fs.existsSync(slugPath)) return slugPath;
  }

  // Try serving static file
  const staticPath = path.join(DIST_DIR, urlPath);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    return staticPath;
  }

  return null;
}

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split('?')[0] || '/';
  const filePath = resolvePath(urlPath);

  if (!filePath || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
  console.log(`Serving from: ${DIST_DIR}`);
});
