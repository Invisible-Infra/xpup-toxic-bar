'use strict'
/**
 * XPUP fetch-worker: only fetches allowlisted fixture hosts.
 * Enforces protocol, timeout, body size, single redirect within allowlist.
 */
const http = require('node:http')
const https = require('node:https')
const { URL } = require('node:url')

const PORT = Number(process.env.PORT || 8090)
const ALLOW = new Set(String(process.env.ALLOW_HOSTS || 'fixture-public,fixture-canary').split(',').map(s => s.trim()).filter(Boolean))
const MAX_BODY = Number(process.env.MAX_BODY || 65536)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 3000)
const MAX_REDIRECTS = Number(process.env.MAX_REDIRECTS || 1)

function fetchOnce (urlString, redirectsLeft) {
  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(urlString)
    } catch (e) {
      reject(Object.assign(new Error('invalid url'), { status: 400 }))
      return
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reject(Object.assign(new Error('protocol not allowed'), { status: 400 }))
      return
    }
    if (!ALLOW.has(parsed.hostname)) {
      reject(Object.assign(new Error('host not allowed'), { status: 403 }))
      return
    }
    const lib = parsed.protocol === 'https:' ? https : http
    const req = lib.get(parsed, { timeout: TIMEOUT_MS }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectsLeft <= 0) {
          reject(Object.assign(new Error('too many redirects'), { status: 400 }))
          return
        }
        const next = new URL(res.headers.location, parsed).toString()
        res.resume()
        fetchOnce(next, redirectsLeft - 1).then(resolve, reject)
        return
      }
      const chunks = []
      let size = 0
      res.on('data', (c) => {
        size += c.length
        if (size > MAX_BODY) {
          req.destroy()
          reject(Object.assign(new Error('body too large'), { status: 400 }))
          return
        }
        chunks.push(c)
      })
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        const m = body.match(/<title[^>]*>([^<]*)<\/title>/i)
        resolve({ title: m ? m[1].trim() : '', status: res.statusCode })
      })
    })
    req.on('timeout', () => {
      req.destroy()
      reject(Object.assign(new Error('timeout'), { status: 504 }))
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  if (req.method !== 'POST' || req.url !== '/fetch') {
    res.writeHead(404)
    res.end()
    return
  }
  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', async () => {
    try {
      const { url } = JSON.parse(raw || '{}')
      console.log(JSON.stringify({ event: 'fetch_attempt', url, allow: [...ALLOW] }))
      const result = await fetchOnce(url, MAX_REDIRECTS)
      console.log(JSON.stringify({ event: 'fetch_ok', url, title: result.title, status: result.status }))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e) {
      console.log(JSON.stringify({ event: 'fetch_deny_or_fail', error: e.message, status: e.status || 502 }))
      res.writeHead(e.status || 502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'fetch failed' }))
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`fetch-worker on ${PORT}; allow=${[...ALLOW].join(',')}`)
})
