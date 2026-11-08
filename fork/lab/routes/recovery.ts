/**
 * XPUP-LAB: Email password recovery with intentional token reuse (L2-01/03).
 * Mail delivery writes to per-instance mailbox directory (no external SMTP package).
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { type Request, type Response, type NextFunction } from 'express'
import { UserModel } from '../../models/user'
import { PasswordResetToken } from '../models/labModels'

function deliverMail (to: string, subject: string, text: string) {
  const dir = process.env.XPUP_MAILBOX_DIR ?? 'data/mailbox'
  fs.mkdirSync(dir, { recursive: true })
  const safe = to.replace(/[^a-zA-Z0-9@._-]/g, '_')
  fs.writeFileSync(path.join(dir, `${Date.now()}-${safe}.eml`), `To: ${to}\nSubject: ${subject}\n\n${text}`)
}

export function requestResetLink () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase()
      if (!email) {
        res.status(400).json({ status: 'error', message: 'email required' })
        return
      }
      const user = await UserModel.findOne({ where: { email } })
      if (!user) {
        res.status(404).json({ status: 'error', message: 'účet nenalezen' })
        return
      }
      await PasswordResetToken.update({ invalidated: true }, { where: { UserId: user.id, invalidated: false } })
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      await PasswordResetToken.create({ UserId: user.id, token, expiresAt, invalidated: false })
      const base = process.env.XPUP_PUBLIC_BASE ?? 'http://localhost:3000'
      deliverMail(email, 'Password reset', `Reset link: ${base}/#/reset-password?token=${token}`)
      res.json({ status: 'success', message: 'odkaz odeslán' })
    } catch (err) {
      next(err)
    }
  }
}

export function resetPasswordWithToken () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = String(req.body?.token ?? '')
      const neu = String(req.body?.new ?? req.body?.password ?? '')
      const repeat = String(req.body?.repeat ?? neu)
      if (!token || !neu || neu !== repeat) {
        res.status(401).json({ status: 'error', message: 'invalid reset' })
        return
      }
      if (neu.length < 15 || neu.length > 128) {
        res.status(401).json({ status: 'error', message: 'password policy' })
        return
      }
      const row = await PasswordResetToken.findOne({ where: { token } })
      if (!row || row.invalidated || row.expiresAt.getTime() <= Date.now()) {
        res.status(401).json({ status: 'error', message: 'invalid or expired token' })
        return
      }
      const user = await UserModel.findByPk(row.UserId)
      if (!user) {
        res.status(401).json({ status: 'error', message: 'invalid or expired token' })
        return
      }
      // L2-03: intentional reuse — do NOT consume token
      await user.update({ password: neu })
      res.json({ status: 'success' })
    } catch (err) {
      next(err)
    }
  }
}
