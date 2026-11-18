/**
 * XPUP-LAB: Support refund (missing role check) and staff audit (role enforced).
 */
import { type Request, type Response, type NextFunction } from 'express'
import { LabOrder } from '../models/labModels'
import { WalletModel } from '../../models/wallet'
import { UserModel } from '../../models/user'
import * as security from '../../lib/insecurity'
import * as utils from '../../lib/utils'

export function refundOrder () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const orderId = req.params.orderId
      const order = await LabOrder.findOne({ where: { publicId: orderId } })
      if (!order) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      const dbUser = await UserModel.findByPk(user.data.id)
      const isStaff = dbUser?.role === 'support' || dbUser?.role === 'accounting'
      // Customers may refund only their own paid order. Support may refund a paid order they can see, including C-R.
      if (!isStaff && order.UserId !== user.data.id) {
        res.status(403).json({ status: 'error', message: 'forbidden' })
        return
      }
      // Must be paid and not yet refunded
      if (order.status !== 'paid' && order.status !== 'confirmed') {
        res.status(400).json({ status: 'error', message: 'not refundable' })
        return
      }
      if (order.refunded || order.paidAmount <= 0) {
        res.status(400).json({ status: 'error', message: 'already refunded or unpaid' })
        return
      }
      // L4-02: intentionally NO support-role check
      await order.update({ refunded: true, status: 'refunded' })
      await WalletModel.increment({ balance: order.paidAmount }, { where: { UserId: order.UserId } })
      res.json({ status: 'success', data: { orderId: order.publicId, refunded: order.paidAmount } })
    } catch (err) {
      next(err)
    }
  }
}

export function staffAudit () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { acceptLabSession } = await import('../session')
      const { UserModel } = await import('../../models/user')
      const session = await acceptLabSession(utils.jwtFrom(req))
      const dbUser = session?.data?.id ? await UserModel.findByPk(session.data.id) : null
      const role = dbUser?.role
      if (role !== 'support' && role !== 'accounting') {
        res.status(403).json({ status: 'error', message: 'forbidden' })
        return
      }
      const orders = await LabOrder.findAll({
        attributes: ['publicId', 'UserId', 'status', 'total', 'paidAmount', 'refunded']
      })
      res.json({ status: 'success', data: orders })
    } catch (err) {
      next(err)
    }
  }
}
