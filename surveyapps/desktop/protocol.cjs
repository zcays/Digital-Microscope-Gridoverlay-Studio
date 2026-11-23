/* Serves allowlisted local resources with explicit MIME types and no caching. */
const {protocol} = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const publicDirectories = ['renderer/', 'assets/', 'vendor/grid-studio/', 'segment/'];
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

exports.installProtocol = function(root) {
  protocol.handle('surveyapps', request => {
    const url = new URL(request.url);
    let file;
    try {
      file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    } catch {
      return new Response('Bad path', {status: 400});
    }

    const relative = path.relative(root, file).split(path.sep).join('/');
    if (url.host !== 'app' || relative.includes('../') || !publicDirectories.some(dir => relative.startsWith(dir))) {
      return new Response('Forbidden', {status: 403});
    }
    try {
      const mime = contentTypes[path.extname(file)] || 'application/octet-stream';
      return new Response(fs.readFileSync(file), {
        headers: {'Content-Type': mime, 'Cache-Control': 'no-store'},
      });
    } catch {
      return new Response('Not found', {status: 404});
    }
  });
};
