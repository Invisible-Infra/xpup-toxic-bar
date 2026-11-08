/**
 * XPUP-LAB: Document reader with intentional path traversal inside fixture root (L7-03).
 */
import fs from 'node:fs'
import path from 'node:path'
import { type Request, type Response, type NextFunction } from 'express'
import { documentsRoot } from '../session'

export function readDocument () {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const ref = String(req.params.ref ?? req.query.ref ?? '')
      if (!ref) {
        res.status(400).json({ status: 'error', message: 'ref required' })
        return
      }
      const publicBase = path.resolve(documentsRoot(), 'public')
      const fixtureRoot = path.resolve(documentsRoot())
      // Intentional flaw: join without proper containment check against publicBase only
      // (allows ../private/canary.txt) but still confined to fixtureRoot
      const candidate = path.resolve(path.join(publicBase, ref))
      if (!candidate.startsWith(fixtureRoot + path.sep) && candidate !== fixtureRoot) {
        res.status(403).json({ status: 'error', message: 'outside fixture' })
        return
      }
      if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      const realRoot = fs.realpathSync(fixtureRoot)
      const realCandidate = fs.realpathSync(candidate)
      if (!realCandidate.startsWith(realRoot + path.sep) && realCandidate !== realRoot) {
        res.status(403).json({ status: 'error', message: 'outside fixture' })
        return
      }
      res.type('text/plain').send(fs.readFileSync(realCandidate, 'utf8'))
    } catch (err) {
      next(err)
    }
  }
}

export function listPublicDocuments () {
  return (_req: Request, res: Response) => {
    const publicBase = path.resolve(documentsRoot(), 'public')
    const files = fs.existsSync(publicBase)
      ? fs.readdirSync(publicBase).filter((f) => fs.statSync(path.join(publicBase, f)).isFile())
      : []
    res.json({ status: 'success', data: files })
  }
}
