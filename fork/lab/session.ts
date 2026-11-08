/**
 * XPUP-LAB: Session persistence and revocation.
 * Logout and password change do not revoke. Role change does.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import { type Request, type Response, type NextFunction } from 'express'
import * as security from '../lib/insecurity'
import { SessionRecord } from './models/labModels'

export const LAB_ROLES = {
  customer: 'customer',
  support: 'support',
  deluxe: 'deluxe',
  accounting: 'accounting',
  admin: 'admin'
} as const

export function tokenHash (token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function persistSession (token: string, userId: number, expiresAt: Date) {
  await SessionRecord.create({
    tokenHash: tokenHash(token),
    UserId: userId,
    expiresAt,
    issuedAt: new Date(),
    revoked: false
  })
}

/** Issue a unique login JWT and persist it. Does not revoke other sessions. */
export async function issueLoginSession (user: { id: number }, basketId: number) {
  const authenticatedUser = { data: user, bid: basketId }
  const token = security.authorize(authenticatedUser)
  security.authenticatedUsers.put(token, authenticatedUser)
  const decoded = security.verifyJwt(token)
  const expMs = Number(decoded?.exp ?? 0) * 1000
  await persistSession(token, user.id, new Date(expMs))
  return { token, bid: basketId }
}

/**
 * Accept a login credential. Expired, revoked or unknown tokens are dropped
 * from the memory cache and do not yield private data.
 * Missing row is a rejection: every completed login writes a SessionRecord.
 * Logout and password change leave the row unrevoked until exp.
 */
export async function acceptLabSession (token?: string) {
  if (!token) return undefined
  const decoded = security.verifyJwt(token)
  if (!decoded?.data?.id || decoded.type) {
    security.forgetToken(token)
    return undefined
  }
  const row = await SessionRecord.findOne({ where: { tokenHash: tokenHash(token) } })
  const expired = !row || row.revoked || new Date(row.expiresAt).getTime() <= Date.now()
  if (expired) {
    security.forgetToken(token)
    return undefined
  }
  if (!security.authenticatedUsers.get(token)) {
    security.authenticatedUsers.put(token, decoded)
  }
  return decoded
}

/** Revoke every persisted session. Logout and password change must not call this. */
export async function revokeAllSessionsForUser (userId: number) {
  await SessionRecord.update({ revoked: true }, { where: { UserId: userId, revoked: false } })
  for (const token of Object.keys(security.authenticatedUsers.tokenMap)) {
    const row = security.authenticatedUsers.get(token)
    if (row?.data?.id === userId) security.forgetToken(token)
  }
}

export function isSupport () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || ''
    const token = header.replace(/^Bearer\s+/i, '') || req.cookies?.token
    const session = await acceptLabSession(token)
    const { UserModel } = await import('../models/user')
    const user = session?.data?.id ? await UserModel.findByPk(session.data.id) : null
    const role = user?.role
    if (role === LAB_ROLES.support || role === LAB_ROLES.accounting) {
      next()
    } else {
      res.status(403).json({ error: 'Forbidden' })
    }
  }
}

export function uploadsRoot () {
  return process.env.XPUP_UPLOADS_DIR ?? 'data/lab-uploads'
}

export function documentsRoot () {
  return process.env.XPUP_DOCUMENTS_DIR ?? 'lab/fixtures/documents'
}

export function ensureLabDirs () {
  for (const dir of [uploadsRoot(), `${documentsRoot()}/public`, `${documentsRoot()}/private`]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}
