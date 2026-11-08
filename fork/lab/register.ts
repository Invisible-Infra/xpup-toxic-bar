/**
 * XPUP-LAB: Wire lab routes, models init hook, CTF surface denial.
 */
import type { Application, Request, Response, NextFunction } from 'express'
import type { Sequelize } from 'sequelize'
import * as security from '../lib/insecurity'
import * as utils from '../lib/utils'
import { initLabModels } from './models/labModels'
import { ensureLabDirs } from './session'
import * as recovery from './routes/recovery'
import * as supportOrders from './routes/supportOrders'
import * as tickets from './routes/tickets'
import * as documents from './routes/documents'
import * as uploads from './routes/uploads'
import * as urlPreview from './routes/urlPreview'
import * as checkout from './routes/checkout'
import * as profile from './routes/profile'

export function initLabPersistence (sequelize: Sequelize) {
  initLabModels(sequelize)
  ensureLabDirs()
}

/** Sequelize sync does not add columns to an existing table. */
export async function ensureLabColumns (sequelize: Sequelize) {
  const [rows] = await sequelize.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'SupportTickets'")
  if (!Array.isArray(rows) || rows.length === 0) return
  const [cols] = await sequelize.query('PRAGMA table_info(SupportTickets)')
  const names = new Set((cols as Array<{ name: string }>).map((col) => col.name))
  for (const column of ['uploadHandle', 'previewUrl', 'previewTitle']) {
    if (!names.has(column)) {
      await sequelize.query(`ALTER TABLE SupportTickets ADD COLUMN ${column} TEXT`)
    }
  }
}

/** Strip / deny CTF and out-of-syllabus upstream shortcuts (not merely hide links). */
export function mountCtfStrip (app: Application) {
  const gone = (_req: Request, res: Response) => {
    res.status(404).json({ status: 'error', message: 'not available' })
  }
  app.all('/api/Challenges', gone)
  app.all('/api/Challenges/*', gone)
  app.all('/api/Hints', gone)
  app.all('/api/Hints/*', gone)
  app.all('/rest/repeat-notification', gone)
  app.all('/rest/continue-code*', gone)
  app.all('/snippets', gone)
  app.all('/snippets/*', gone)
  app.all('/solve/challenges/*', gone)
  app.all('/b2b/v2/*', gone)
  app.all('/profile/image/url', gone)
  app.post('/rest/deluxe-membership', gone)
  // Out-of-syllabus: chatbot / Web3 / NFT
  app.all('/rest/chat', gone)
  app.all('/rest/chat/*', gone)
  app.all('/rest/web3', gone)
  app.all('/rest/web3/*', gone)
}

/** Call before finale.resource registration so GET /api/Challenges cannot win. */
export function mountCtfStripEarly (app: Application) {
  mountCtfStrip(app)
}

export function mountLabRoutes (app: Application) {
  mountCtfStrip(app)

  // Recovery (email)
  app.post('/rest/user/reset-link', utils.asyncHandler(recovery.requestResetLink()))
  app.post('/rest/user/reset-password-token', utils.asyncHandler(recovery.resetPasswordWithToken()))

  // Profile JSON (L5)
  app.get('/rest/lab/profile', security.isAuthorized(), utils.asyncHandler(profile.readProfileJson()))
  app.put('/rest/lab/profile', security.isAuthorized(), utils.asyncHandler(profile.updateProfileJson()))

  // Support orders
  app.post('/rest/support/orders/:orderId/refund', security.isAuthorized(), utils.asyncHandler(supportOrders.refundOrder()))
  app.get('/rest/support/orders/audit', security.isAuthorized(), utils.asyncHandler(supportOrders.staffAudit()))

  // Tickets
  app.post('/rest/support/tickets', security.isAuthorized(), utils.asyncHandler(tickets.createTicket()))
  app.get('/rest/support/tickets', security.isAuthorized(), utils.asyncHandler(tickets.listOwnTickets()))
  app.get('/rest/support/tickets/:id', security.isAuthorized(), utils.asyncHandler(tickets.readTicket()))

  // Documents
  app.get('/rest/documents', documents.listPublicDocuments())
  app.get('/rest/document', documents.readDocument())
  app.get('/rest/documents/:ref', documents.readDocument())

  // Uploads
  app.post('/rest/uploads', security.isAuthorized(), uploads.labUploadMiddleware, utils.asyncHandler(uploads.createUpload()))
  app.get('/rest/uploads/:handle', security.isAuthorized(), utils.asyncHandler(uploads.uploadStatus()))
  app.get('/rest/uploads/:handle/download', security.isAuthorized(), utils.asyncHandler(uploads.downloadUpload()))
  app.delete('/rest/uploads/:handle', security.isAuthorized(), utils.asyncHandler(uploads.deleteUpload()))

  // SSRF preview
  app.post('/rest/url-preview', security.isAuthorized(), utils.asyncHandler(urlPreview.urlPreview()))

  // Checkout L9
  app.post('/rest/lab/coupon', security.isAuthorized(), utils.asyncHandler(checkout.applyLabCoupon()))
  app.post('/rest/checkout/quote', security.isAuthorized(), utils.asyncHandler(checkout.checkoutQuote()))
  app.get('/rest/lab/orders', security.isAuthorized(), utils.asyncHandler(checkout.listOrders()))
  app.post('/rest/lab/orders', security.isAuthorized(), utils.asyncHandler(checkout.createPreparedOrder()))
  app.post('/rest/orders/:id/pay-wallet', security.isAuthorized(), utils.asyncHandler(checkout.payWallet()))
  app.post('/rest/orders/:id/confirm', security.isAuthorized(), utils.asyncHandler(checkout.confirmOrder()))
  app.post('/rest/orders/:id/cancel', security.isAuthorized(), utils.asyncHandler(checkout.cancelOrder()))
  app.get('/rest/orders/:id', security.isAuthorized(), utils.asyncHandler(checkout.readOrder()))

  // Client logout without server revoke (L3-01)
  app.post('/rest/user/logout', security.isAuthorized(), (_req: Request, res: Response) => {
    res.json({ status: 'success' })
  })
}

/** Block role mass-assignment on registration; enforce password length policy. */
export function blockRoleOnRegister () {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      delete req.body.role
    }
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'isVip')) {
      delete req.body.isVip
    }
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'balance')) {
      delete req.body.balance
    }
    const pwd = req.body?.password
    if (typeof pwd === 'string' && (pwd.length < 15 || pwd.length > 128)) {
      res.status(400).json({ status: 'error', message: 'password policy: length 15-128' })
      return
    }
    next()
  }
}
