/**
 * XPUP-LAB: URL preview via fetch-worker (SSRF lab surface L8-03).
 */
import { type Request, type Response, type NextFunction } from 'express'
import * as security from '../../lib/insecurity'

const FETCH_WORKER = process.env.XPUP_FETCH_WORKER_URL ?? 'http://fetch-worker:8090/fetch'
const TIMEOUT_MS = 3000

export function urlPreview () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const url = String(req.body?.url ?? '')
      if (!url) {
        res.status(400).json({ status: 'error', message: 'url required' })
        return
      }
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        res.status(400).json({ status: 'error', message: 'invalid url' })
        return
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        res.status(400).json({ status: 'error', message: 'protocol not allowed' })
        return
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        const upstream = await fetch(FETCH_WORKER, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: controller.signal
        })
        const body = await upstream.json() as { title?: string, error?: string }
        if (!upstream.ok) {
          res.status(502).json({ status: 'error', message: body.error ?? 'preview failed' })
          return
        }
        res.json({ status: 'success', data: { title: body.title ?? '', url } })
      } finally {
        clearTimeout(timer)
      }
    } catch (err) {
      next(err)
    }
  }
}
