/**
 * XPUP-LAB: Upload lifecycle — trusts extension/MIME, not content sniffing (L8-01/02).
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { type Request, type Response, type NextFunction } from 'express'
import { PNG } from 'pngjs'
import * as jpeg from 'jpeg-js'
import { LabUpload } from '../models/labModels'
import { uploadsRoot } from '../session'
import * as security from '../../lib/insecurity'

const MAX_BYTES = 524288
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg'])
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg'])

const storage = multer.memoryStorage()
export const labUploadMiddleware = multer({ storage, limits: { fileSize: MAX_BYTES + 1 } }).single('file')

function previewStatusFor (buf: Buffer, ext: string): 'ready' | 'unavailable' {
  try {
    if (ext === '.png') {
      const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      if (buf.length < signature.length || !buf.subarray(0, signature.length).equals(signature)) return 'unavailable'
      const decoded = PNG.sync.read(buf)
      return decoded.width > 0 && decoded.height > 0 ? 'ready' : 'unavailable'
    }
    if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return 'unavailable'
    const decoded = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 16 })
    return decoded.width > 0 && decoded.height > 0 ? 'ready' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export function createUpload () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const file = (req as any).file as Express.Multer.File | undefined
      if (!file) {
        res.status(400).json({ status: 'error', message: 'file required' })
        return
      }
      const originalName = file.originalname || 'upload.bin'
      const ext = path.extname(originalName).toLowerCase()
      const mime = String(file.mimetype || req.body?.mime || '')
      if (!ALLOWED_EXT.has(ext)) {
        res.status(400).json({ status: 'error', message: 'extension not allowed' })
        return
      }
      if (!ALLOWED_MIME.has(mime)) {
        res.status(400).json({ status: 'error', message: 'mime not allowed' })
        return
      }
      if (file.size === 0 || file.size > MAX_BYTES) {
        res.status(400).json({ status: 'error', message: 'size not allowed' })
        return
      }
      // L8-01: no content sniffing reject — text disguised as png is stored
      const handle = crypto.randomBytes(16).toString('hex')
      const storedName = `${handle}${ext}`
      const dir = uploadsRoot()
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, storedName), file.buffer)
      const previewStatus = previewStatusFor(file.buffer, ext)
      const row = await LabUpload.create({
        handle,
        UserId: user.data.id,
        originalName,
        storedName,
        declaredMime: mime,
        size: file.size,
        previewStatus
      })
      res.status(201).json({
        status: 'success',
        data: { handle: row.handle, size: row.size, previewStatus: row.previewStatus, originalName: row.originalName }
      })
    } catch (err) {
      next(err)
    }
  }
}

export function uploadStatus () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const row = await LabUpload.findOne({ where: { handle: req.params.handle } })
      if (!row || row.UserId !== user.data.id) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      res.json({ status: 'success', data: { handle: row.handle, size: row.size, previewStatus: row.previewStatus, originalName: row.originalName } })
    } catch (err) {
      next(err)
    }
  }
}

export function downloadUpload () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const row = await LabUpload.findOne({ where: { handle: req.params.handle } })
      if (!row || row.UserId !== user.data.id) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      // Path traversal via original name must not escape — serve only storedName
      const safe = path.basename(row.storedName)
      const full = path.join(uploadsRoot(), safe)
      if (!full.startsWith(path.resolve(uploadsRoot()))) {
        res.status(403).json({ status: 'error', message: 'forbidden' })
        return
      }
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(row.originalName)}"`)
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.sendFile(path.resolve(full))
    } catch (err) {
      next(err)
    }
  }
}

export function deleteUpload () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const row = await LabUpload.findOne({ where: { handle: req.params.handle } })
      if (!row || row.UserId !== user.data.id) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      const full = path.join(uploadsRoot(), path.basename(row.storedName))
      if (fs.existsSync(full)) fs.unlinkSync(full)
      await row.destroy()
      res.json({ status: 'success' })
    } catch (err) {
      next(err)
    }
  }
}
