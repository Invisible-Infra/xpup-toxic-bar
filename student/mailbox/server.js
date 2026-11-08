'use strict'
// Read-only local L2 recovery mailbox; no Docker API, no exposed credentials.
// The port is bound to 127.0.0.1 by compose.yaml.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { URL } = require('node:url')

const MAILDIR = '/mailbox'
const PORT = Number(process.env.PORT || 8080)
const MAX_BYTES = 256 * 1024
const FILENAME = /^[a-zA-Z0-9@._-]+\.eml$/

function escapeHtml (value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c])
}

function response (res, status, mime, text) {
  res.writeHead(status, {
    'Content-Type': mime,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  })
  res.end(text)
}

function list () {
  return fs.readdirSync(MAILDIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && FILENAME.test(entry.name))
    .map(entry => {
      const stats = fs.lstatSync(path.join(MAILDIR, entry.name))
      return { name: entry.name, mtime: stats.mtime.toISOString(), size: stats.size }
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime))
}

http.createServer((req, res) => {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase()
  if (host !== '127.0.0.1' && host !== 'localhost') {
    return response(res, 403, 'text/plain; charset=utf-8', 'localhost only')
  }
  if (req.method !== 'GET') {
    return response(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
  }
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname === '/health') {
    return response(res, 200, 'text/plain; charset=utf-8', 'OK')
  }
  if (url.pathname.startsWith('/m/')) {
    let name
    try { name = decodeURIComponent(url.pathname.slice(3)) } catch {
      return response(res, 400, 'text/plain; charset=utf-8', 'invalid filename')
    }
    if (!FILENAME.test(name)) {
      return response(res, 400, 'text/plain; charset=utf-8', 'invalid filename')
    }
    const file = path.join(MAILDIR, name)
    try {
      const st = fs.lstatSync(file)
      if (!st.isFile() || st.size > MAX_BYTES) {
        return response(res, 400, 'text/plain; charset=utf-8', 'invalid message')
      }
      return response(res, 200, 'text/plain; charset=utf-8', fs.readFileSync(file))
    } catch {
      return response(res, 404, 'text/plain; charset=utf-8', 'not found')
    }
  }
  if (url.pathname !== '/') {
    return response(res, 404, 'text/plain; charset=utf-8', 'not found')
  }
  try {
    const link = escapeHtml(process.env.APP_URL || 'http://127.0.0.1:3000')
    const rows = list().map(msg =>
      '<li><a href="/m/' + encodeURIComponent(msg.name) + '">' +
      escapeHtml(msg.name) + '</a> (' + msg.size + ' B)</li>'
    ).join('')
    const html = '<!doctype html><html lang="cs"><meta charset="utf-8">' +
      '<title>Toxic Bar – lokální schránka</title>' +
      '<style>body{font:16px system-ui;margin:2rem auto;max-width:45rem;padding:0 1rem}' +
      'li{margin:.7em 0}</style><h1>Lokální schránka – Toxic Bar</h1>' +
      '<p>Recovery e-maily z L2. <a href="' + link + '">Otevřít e-shop</a></p>' +
      '<p><a href="/">Obnovit schránku</a></p><ul>' +
      (rows || '<li>Schránka je prázdná.</li>') + '</ul></html>'
    response(res, 200, 'text/html; charset=utf-8', html)
  } catch {
    response(res, 503, 'text/plain; charset=utf-8', 'mailbox unavailable')
  }
}).listen(PORT, '0.0.0.0')
