/**
 * XPUP-LAB: Profile JSON update with intentional VIP mass-assignment (L5).
 */
import { type Request, type Response, type NextFunction } from 'express'
import { UserModel } from '../../models/user'
import { WalletModel } from '../../models/wallet'
import * as security from '../../lib/insecurity'

const ALLOWED = new Set(['username', 'isVip'])

export function updateProfileJson () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const body = req.body ?? {}
      // Reject unknown keys and privileged fields (except intentional isVip)
      for (const key of Object.keys(body)) {
        if (key === 'role' || key === 'balance' || key === 'wallet' || key === 'UserId' || key === 'id' || key === 'email' || key === 'password' || key === 'totpSecret') {
          res.status(400).json({ status: 'error', message: `field not allowed: ${key}` })
          return
        }
        if (!ALLOWED.has(key)) {
          res.status(400).json({ status: 'error', message: `unknown field: ${key}` })
          return
        }
      }
      if (body.isVip !== undefined && typeof body.isVip !== 'boolean') {
        res.status(400).json({ status: 'error', message: 'isVip must be boolean' })
        return
      }
      const dbUser = await UserModel.findByPk(user.data.id)
      if (!dbUser) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      const patch: Record<string, unknown> = {}
      if (body.username !== undefined) patch.username = String(body.username)
      // L5-01: accept isVip
      if (body.isVip !== undefined) patch.isVip = body.isVip
      await dbUser.update(patch)
      const fresh = await UserModel.findByPk(user.data.id)
      const wallet = await WalletModel.findOne({ where: { UserId: user.data.id } })
      res.json({
        status: 'success',
        data: {
          id: fresh?.id,
          username: fresh?.username,
          email: fresh?.email,
          role: fresh?.role,
          isVip: Boolean((fresh as any)?.isVip),
          balance: wallet?.balance ?? 0
        }
      })
    } catch (err) {
      next(err)
    }
  }
}

export function readProfileJson () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = security.authenticatedUsers.from(req)
      if (!user?.data?.id) {
        res.status(401).json({ status: 'error', message: 'unauthorized' })
        return
      }
      const dbUser = await UserModel.findByPk(user.data.id)
      if (!dbUser) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      const wallet = await WalletModel.findOne({ where: { UserId: dbUser.id } })
      res.json({
        status: 'success',
        data: {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
          role: dbUser.role,
          isVip: Boolean((dbUser as any).isVip),
          balance: wallet?.balance ?? 0
        }
      })
    } catch (err) {
      next(err)
    }
  }
}
