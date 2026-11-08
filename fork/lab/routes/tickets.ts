/**
 * XPUP-LAB: Support tickets with intentional stored XSS on staff read (L7-02).
 */
import { type Request, type Response, type NextFunction } from 'express'
import { LabUpload, SupportTicket } from '../models/labModels'
import { UserModel } from '../../models/user'
import * as security from '../../lib/insecurity'

function escapeHtml (value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch))
}

async function callerIsSupport (userId: number) {
  const dbUser = await UserModel.findByPk(userId)
  return dbUser?.role === 'support' || dbUser?.role === 'accounting'
}

export function createTicket () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const message = String(req.body?.message ?? '')
      if (!message) {
        res.status(400).json({ status: 'error', message: 'message required' })
        return
      }
      const uploadHandle = req.body?.uploadHandle ? String(req.body.uploadHandle) : null
      if (uploadHandle) {
        const upload = await LabUpload.findOne({ where: { handle: uploadHandle, UserId: user.data.id } })
        if (!upload) {
          res.status(400).json({ status: 'error', message: 'upload not found' })
          return
        }
      }
      const previewUrl = req.body?.previewUrl ? String(req.body.previewUrl).slice(0, 500) : null
      const previewTitle = req.body?.previewTitle != null ? String(req.body.previewTitle).slice(0, 300) : null
      // Store the message raw — intentional XSS sink for the staff HTML view
      const ticket = await SupportTicket.create({
        UserId: user.data.id,
        message,
        uploadHandle,
        previewUrl,
        previewTitle
      })
      res.status(201).json({ status: 'success', data: { id: ticket.id } })
    } catch (err) {
      next(err)
    }
  }
}

export function readTicket () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const ticket = await SupportTicket.findByPk(req.params.id)
      if (!ticket) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      const isOwner = ticket.UserId === user.data.id
      const isSupport = await callerIsSupport(user.data.id)
      if (!isOwner && !isSupport) {
        res.status(403).json({ status: 'error', message: 'forbidden' })
        return
      }
      // Staff HTML view: the message is the intentional sink. Preview title stays text.
      if (String(req.query.format) === 'html' && isSupport) {
        res.type('html').send(`<!doctype html><html><body><h1>Ticket ${ticket.id}</h1><div id="ticket-body">${ticket.message}</div><p id="preview-title">${escapeHtml(ticket.previewTitle ?? '')}</p></body></html>`)
        return
      }
      res.json({ status: 'success', data: ticket })
    } catch (err) {
      next(err)
    }
  }
}

export function listOwnTickets () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const where = (await callerIsSupport(user.data.id)) ? {} : { UserId: user.data.id }
      const tickets = await SupportTicket.findAll({ where })
      res.json({ status: 'success', data: tickets })
    } catch (err) {
      next(err)
    }
  }
}
