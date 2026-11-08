/**
 * XPUP-LAB: Checkout quote / coupon / pay / confirm / cancel (L9).
 */
import crypto from 'node:crypto'
import { type Request, type Response, type NextFunction } from 'express'
import { LabOrder, CouponRedemption } from '../models/labModels'
import { ProductModel } from '../../models/product'
import { WalletModel } from '../../models/wallet'
import { UserModel } from '../../models/user'
import { AddressModel } from '../../models/address'
import { DeliveryModel } from '../../models/delivery'
import { QuantityModel } from '../../models/quantity'
import * as security from '../../lib/insecurity'

const LAB_COUPON = process.env.XPUP_COUPON_CODE ?? 'LAB20'
const COUPON_AMOUNT = 20
const DEFAULT_DELIVERY = 20

export function applyLabCoupon () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const code = String(req.body?.code ?? req.params.coupon ?? '').toUpperCase()
      const basketId = Number(req.body?.basketId ?? req.params.id ?? 0) || null
      if (code !== LAB_COUPON) {
        res.status(404).json({ status: 'error', message: 'Invalid coupon.' })
        return
      }
      const orderId = String(req.body?.orderId ?? '')
      if (orderId) {
        const existing = await LabOrder.findOne({ where: { publicId: orderId, UserId: user.data.id } })
        if (existing && ['paid', 'confirmed', 'cancelled', 'refunded'].includes(existing.status)) {
          res.status(400).json({ status: 'error', message: 'order closed' })
          return
        }
      }
      // L9-01: intentional double-apply — always record another redemption
      await CouponRedemption.create({
        UserId: user.data.id,
        code,
        BasketId: basketId,
        amount: COUPON_AMOUNT
      })
      const redemptions = await CouponRedemption.count({ where: { UserId: user.data.id, code } })
      res.json({ status: 'success', data: { discount: COUPON_AMOUNT * redemptions, applications: redemptions } })
    } catch (err) {
      next(err)
    }
  }
}

export function checkoutQuote () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const productId = Number(req.body?.productId)
      const quantity = Number(req.body?.quantity ?? 1)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        res.status(400).json({ status: 'error', message: 'invalid quantity' })
        return
      }
      const product = await ProductModel.findByPk(productId)
      if (!product) {
        res.status(404).json({ status: 'error', message: 'product not found' })
        return
      }
      // L9-03: trust client unitPrice when provided
      let unitPrice = Number(product.price)
      if (req.body?.unitPrice !== undefined && req.body?.unitPrice !== null) {
        const clientPrice = Number(req.body.unitPrice)
        if (!Number.isFinite(clientPrice) || clientPrice < 0) {
          res.status(400).json({ status: 'error', message: 'invalid unitPrice' })
          return
        }
        unitPrice = clientPrice
      }
      const dbUser = await UserModel.findByPk(user.data.id)
      const isVip = Boolean((dbUser as any)?.isVip)
      const deliveryPrice = isVip ? 0 : DEFAULT_DELIVERY
      const redemptions = await CouponRedemption.count({ where: { UserId: user.data.id, code: LAB_COUPON } })
      const couponDiscount = COUPON_AMOUNT * redemptions
      const total = Math.max(0, unitPrice * quantity + deliveryPrice - couponDiscount)
      res.json({
        status: 'success',
        data: {
          productId,
          quantity,
          unitPrice,
          deliveryPrice,
          couponDiscount,
          total,
          isVip
        }
      })
    } catch (err) {
      next(err)
    }
  }
}

export function createPreparedOrder () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const addressId = Number(req.body?.addressId)
      const deliveryMethodId = Number(req.body?.deliveryMethodId)
      const address = addressId ? await AddressModel.findOne({ where: { id: addressId, UserId: user.data.id } }) : null
      const delivery = deliveryMethodId ? await DeliveryModel.findByPk(deliveryMethodId) : null
      if (!address || !delivery) {
        res.status(400).json({ status: 'error', message: 'address and delivery required' })
        return
      }
      const productId = Number(req.body?.productId)
      const quantity = Number(req.body?.quantity ?? 1)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        res.status(400).json({ status: 'error', message: 'invalid quantity' })
        return
      }
      const product = await ProductModel.findByPk(productId)
      if (!product) {
        res.status(404).json({ status: 'error', message: 'product not found' })
        return
      }
      let unitPrice = Number(product.price)
      if (req.body?.unitPrice !== undefined && req.body?.unitPrice !== null) {
        const clientPrice = Number(req.body.unitPrice)
        if (!Number.isFinite(clientPrice) || clientPrice < 0) {
          res.status(400).json({ status: 'error', message: 'invalid unitPrice' })
          return
        }
        unitPrice = clientPrice
      }
      const dbUser = await UserModel.findByPk(user.data.id)
      const isVip = Boolean((dbUser as any)?.isVip)
      const deliveryPrice = isVip ? 0 : DEFAULT_DELIVERY
      const redemptions = await CouponRedemption.count({ where: { UserId: user.data.id, code: LAB_COUPON } })
      const couponDiscount = COUPON_AMOUNT * redemptions
      const total = Math.max(0, unitPrice * quantity + deliveryPrice - couponDiscount)
      const publicId = crypto.randomBytes(8).toString('hex')
      const order = await LabOrder.create({
        publicId,
        UserId: user.data.id,
        status: 'awaiting_payment',
        total,
        paidAmount: 0,
        unitPrice,
        quantity,
        deliveryPrice,
        couponDiscount,
        addressId,
        deliveryMethodId,
        refunded: false,
        ProductId: productId
      })
      res.status(201).json({ status: 'success', data: order })
    } catch (err) {
      next(err)
    }
  }
}

export function payWallet () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const order = await LabOrder.findOne({ where: { publicId: req.params.id, UserId: user.data.id } })
      if (!order) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      if (order.status === 'paid' || order.status === 'confirmed') {
        res.json({ status: 'success', data: order }) // idempotent
        return
      }
      if (order.status === 'cancelled') {
        res.status(400).json({ status: 'error', message: 'cancelled' })
        return
      }
      const wallet = await WalletModel.findOne({ where: { UserId: user.data.id } })
      if (!wallet || wallet.balance < order.total) {
        res.status(402).json({ status: 'error', message: 'insufficient funds' })
        return
      }
      await WalletModel.decrement({ balance: order.total }, { where: { UserId: user.data.id } })
      await order.update({ status: 'paid', paidAmount: order.total })
      res.json({ status: 'success', data: order })
    } catch (err) {
      next(err)
    }
  }
}

export function confirmOrder () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const order = await LabOrder.findOne({ where: { publicId: req.params.id, UserId: user.data.id } })
      if (!order) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      if (!order.addressId || !order.deliveryMethodId) {
        res.status(400).json({ status: 'error', message: 'address/delivery required' })
        return
      }
      if (order.status === 'cancelled') {
        res.status(400).json({ status: 'error', message: 'cancelled' })
        return
      }
      if (order.status === 'confirmed') {
        res.json({ status: 'success', data: order }) // idempotent
        return
      }
      // L9-02: intentional — confirm without requiring paid
      await order.update({ status: 'confirmed' })
      const stock = await QuantityModel.findOne({ where: { ProductId: order.ProductId } })
      if (stock) await stock.decrement('quantity', { by: order.quantity })
      res.json({ status: 'success', data: order })
    } catch (err) {
      next(err)
    }
  }
}

export function cancelOrder () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const order = await LabOrder.findOne({ where: { publicId: req.params.id, UserId: user.data.id } })
      if (!order) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      if (order.status === 'confirmed' || order.status === 'paid') {
        res.status(400).json({ status: 'error', message: 'cannot cancel' })
        return
      }
      await order.update({ status: 'cancelled' })
      res.json({ status: 'success', data: order })
    } catch (err) {
      next(err)
    }
  }
}

export function listOrders () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const dbUser = await UserModel.findByPk(user.data.id)
      const staff = dbUser?.role === 'support' || dbUser?.role === 'accounting'
      const orders = await LabOrder.findAll({
        where: staff ? {} : { UserId: user.data.id },
        order: [['id', 'DESC']]
      })
      res.json({ status: 'success', data: orders })
    } catch (err) {
      next(err)
    }
  }
}

export function readOrder () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const order = await LabOrder.findOne({ where: { publicId: req.params.id, UserId: user.data.id } })
      if (!order) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      res.json({ status: 'success', data: order })
    } catch (err) {
      next(err)
    }
  }
}
