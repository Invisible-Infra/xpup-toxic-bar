/**
 * XPUP-LAB: Per-account TOTP limits persisted in sqlite (survive restart).
 * Password login stays unlimited. These limits apply only to the second factor.
 */
import { Op } from 'sequelize'
import { TotpChallenge, TotpFailure, TotpUsedStep } from './models/labModels'

const WINDOW_MS = 5 * 60 * 1000
const MAX_FAILURES = 5

export async function totpBlocked (userId: number, jti: string) {
  const invalidated = jti
    ? await TotpChallenge.findOne({ where: { jti, invalidated: true } })
    : null
  if (invalidated) return true
  const recent = await TotpFailure.count({
    where: { UserId: userId, createdAt: { [Op.gte]: new Date(Date.now() - WINDOW_MS) } }
  })
  return recent >= MAX_FAILURES
}

export async function recordTotpFailure (userId: number, jti: string) {
  await TotpFailure.create({ UserId: userId, createdAt: new Date() })
  const recent = await TotpFailure.count({
    where: { UserId: userId, createdAt: { [Op.gte]: new Date(Date.now() - WINDOW_MS) } }
  })
  if (recent >= MAX_FAILURES && jti) {
    await TotpChallenge.findOrCreate({
      where: { jti },
      defaults: { jti, UserId: userId, invalidated: true }
    })
    await TotpChallenge.update({ invalidated: true }, { where: { jti } })
  }
}

export async function totpStepUsed (userId: number, step: number) {
  const row = await TotpUsedStep.findOne({ where: { UserId: userId, step } })
  return Boolean(row)
}

export async function rememberTotpStep (userId: number, step: number) {
  await TotpUsedStep.create({ UserId: userId, step })
}
