/**
 * XPUP-LAB: Fixture role change for L3-03 (harness only, shared secret).
 */
import { type Request, type Response, type NextFunction } from 'express'
import { UserModel } from '../../models/user'
import { revokeAllSessionsForUser } from '../session'

export function roleChangeHarness () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expected = process.env.XPUP_HARNESS_SECRET ?? ''
      const provided = String(req.headers['x-xpup-harness'] ?? '')
      if (!expected || provided !== expected) {
        res.status(404).json({ status: 'error', message: 'not found' })
        return
      }
      const email = String(req.body?.email ?? '')
      const role = String(req.body?.role ?? '')
      if (!email || !['customer', 'support'].includes(role)) {
        res.status(400).json({ status: 'error', message: 'invalid' })
        return
      }
      const user = await UserModel.findOne({ where: { email } })
      if (!user) {
        res.status(404).json({ status: 'error', message: 'user not found' })
        return
      }
      await user.update({ role })
      // L3-03: revoke all sessions on role change
      await revokeAllSessionsForUser(user.id)
      res.json({ status: 'success', data: { email, role } })
    } catch (err) {
      next(err)
    }
  }
}
