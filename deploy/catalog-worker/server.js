'use strict'
/**
 * Read-only search over the product catalog copy.
 * The account database is not mounted in this container.
 */
const http = require('node:http')
const fs = require('node:fs')

const PORT = Number(process.env.PORT || 8091)
const CATALOG_PATH = process.env.CATALOG_PATH || '/data/catalog.sqlite'

function search (q) {
  const { DatabaseSync } = require('node:sqlite')
  if (!fs.existsSync(CATALOG_PATH)) {
    const err = new Error('catalog not ready')
    err.status = 503
    throw err
  }
  const db = new DatabaseSync(CATALOG_PATH, { readOnly: true })
  try {
    db.exec('PRAGMA query_only = ON')
    const sql = `SELECT * FROM Products WHERE ((name LIKE '%${q}%' OR description LIKE '%${q}%') AND deletedAt IS NULL) ORDER BY name`
    return db.prepare(sql).all()
  } finally {
    db.close()
  }
}

function readBody (req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 8192) {
        reject(Object.assign(new Error('body too large'), { status: 400 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }))
      }
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
  if (req.method !== 'POST' || req.url !== '/search') {
    res.writeHead(404)
    res.end()
    return
  }
  try {
    const body = await readBody(req)
    let q = String(body.q ?? '')
    if (q.length > 200) q = q.slice(0, 200)
    const data = search(q)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ data }))
  } catch (err) {
    const status = err.status || 500
    const message = String(err.message || 'search failed').replace(/\/[\w./-]+/g, '')
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message }))
  }
})

server.listen(PORT, () => {
  process.stdout.write(`catalog-worker listening on ${PORT}\n`)
})
