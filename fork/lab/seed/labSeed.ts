/**
 * XPUP-LAB: Deterministic seed overlay for APP_MODEL fixtures.
 * Invoked after upstream datacreator when XPUP_LAB_SEED=1 or on factory reset.
 */
import fs from 'node:fs'
import path from 'node:path'
import { UserModel } from '../../models/user'
import { ProductModel } from '../../models/product'
import { AddressModel } from '../../models/address'
import { WalletModel } from '../../models/wallet'
import { BasketModel } from '../../models/basket'
import { QuantityModel } from '../../models/quantity'
import { LabOrder } from '../models/labModels'
import { documentsRoot, ensureLabDirs } from '../session'

export interface SeedManifest {
  instanceId: string
  generatedAt: string
  accounts: Record<string, { email: string, role: string, id?: number }>
  products: Record<string, { id?: number, name: string, price: number, hidden?: boolean }>
  orders: Record<string, { publicId: string, owner: string }>
  coupon: string
}

const DOMAIN = 'lab.test'

function email (local: string) {
  return `${local}@${DOMAIN}`
}

/** Write fixture text when possible; skip if already present and unwritable (host-prepared). */
function writeFixtureFile (filePath: string, content: string) {
  try {
    if (fs.existsSync(filePath)) {
      const current = fs.readFileSync(filePath, 'utf8')
      if (current === content) return
    }
    fs.writeFileSync(filePath, content)
  } catch (err: any) {
    if (err?.code === 'EACCES' && fs.existsSync(filePath)) return
    throw err
  }
}

export async function seedLabFixtures (secrets: Record<string, string> = {}): Promise<SeedManifest> {
  ensureLabDirs()
  const pwd = (key: string, fallback: string) => secrets[key] ?? process.env[key] ?? fallback

  const accountsDef = [
    { key: 'A', email: email('a'), role: 'customer', username: 'Customer A', password: pwd('XPUP_PASSWORD_A', 'LabPasswordA15chars!') },
    { key: 'B', email: email('b'), role: 'customer', username: 'Customer B', password: pwd('XPUP_PASSWORD_B', 'LabPasswordB15chars!') },
    { key: 'C', email: email('c'), role: 'customer', username: 'Customer C', password: pwd('XPUP_PASSWORD_C', 'LabPasswordC15chars!') },
    { key: 'T', email: email('t'), role: 'support', username: 'Support T', password: pwd('XPUP_PASSWORD_T', 'LabPasswordT15chars!') },
    { key: 'S', email: email('s'), role: 'support', username: 'Support S', password: pwd('XPUP_PASSWORD_S', 'LabPasswordS15chars!') },
    { key: 'P', email: email('p'), role: 'customer', username: 'Test P', password: pwd('XPUP_PASSWORD_P', 'LabPasswordP15chars!'), isVip: false },
    { key: 'W', email: email('w'), role: 'customer', username: 'Customer W', password: pwd('XPUP_PASSWORD_W', 'LabPasswordW15chars!'), isVip: false }
  ]

  const accounts: SeedManifest['accounts'] = {}
  for (const a of accountsDef) {
    let user = await UserModel.findOne({ where: { email: a.email } })
    if (!user) {
      user = await UserModel.create({
        email: a.email,
        password: a.password,
        username: a.username,
        role: a.role,
        isVip: Boolean((a as any).isVip)
      } as any)
    } else {
      await user.update({ role: a.role, username: a.username, isVip: Boolean((a as any).isVip) } as any)
      // password refresh only when explicit secret provided
      if (secrets[`XPUP_PASSWORD_${a.key}`]) {
        await user.update({ password: a.password })
      }
    }
    await WalletModel.findOrCreate({ where: { UserId: user.id }, defaults: { UserId: user.id, balance: 500 } as any })
    await BasketModel.findOrCreate({ where: { UserId: user.id }, defaults: { UserId: user.id } as any })
    accounts[a.key] = { email: a.email, role: a.role, id: user.id }
  }

  // Products V (public) and H (hidden)
  let productV = await ProductModel.findOne({ where: { name: 'Lab Product V' } })
  if (!productV) {
    productV = await ProductModel.create({
      name: 'Lab Product V',
      description: 'Public lab product V',
      price: 100,
      deluxePrice: 100,
      image: 'lab-v.jpg'
    } as any)
  } else {
    await productV.update({ price: 100, deluxePrice: 100 })
  }
  const stock = await QuantityModel.findOne({ where: { ProductId: productV.id } })
  if (!stock) await QuantityModel.create({ ProductId: productV.id, quantity: 20 } as any)

  let productH = await ProductModel.findOne({ where: { name: 'Lab Hidden H-MARKER' }, paranoid: false })
  if (!productH) {
    productH = await ProductModel.create({
      name: 'Lab Hidden H-MARKER',
      description: 'Hidden catalog marker product',
      price: 1,
      deluxePrice: 1,
      image: 'lab-h.jpg'
    } as any)
  }
  // Soft-delete H so normal catalog/search (deletedAt IS NULL) hides it unless SQLi
  if (!(productH as any).deletedAt) {
    await productH.destroy()
  }

  // Addresses
  const userA = await UserModel.findOne({ where: { email: email('a') } })
  const userB = await UserModel.findOne({ where: { email: email('b') } })
  async function ensureAddress (uid: number, marker: string) {
    const existing = await AddressModel.findOne({ where: { UserId: uid, fullName: marker } })
    if (existing) return existing
    return AddressModel.create({
      UserId: uid,
      fullName: marker,
      mobileNum: 1234567890,
      zipCode: '10000',
      streetAddress: `${marker} Street 1`,
      city: 'LabCity',
      state: 'LS',
      country: 'CZ'
    } as any)
  }
  if (userA) await ensureAddress(userA.id, 'ADDRESS-A-MARKER')
  if (userB) await ensureAddress(userB.id, 'ADDRESS-B-MARKER')

  // Orders A-R, B-R, C-R paid; A-U unpaid
  const orders: SeedManifest['orders'] = {}
  async function ensureOrder (key: string, ownerKey: string, status: string, paid: number) {
    const owner = accounts[ownerKey]
    const publicId = `order-${key.toLowerCase()}`
    let order = await LabOrder.findOne({ where: { publicId } })
    if (!order) {
      order = await LabOrder.create({
        publicId,
        UserId: owner.id!,
        status,
        total: 120,
        paidAmount: paid,
        unitPrice: 100,
        quantity: 1,
        deliveryPrice: 20,
        couponDiscount: 0,
        addressId: null,
        deliveryMethodId: 1,
        refunded: false,
        ProductId: productV!.id
      })
    }
    orders[key] = { publicId, owner: ownerKey }
  }
  await ensureOrder('A-R', 'A', 'paid', 120)
  await ensureOrder('B-R', 'B', 'paid', 120)
  await ensureOrder('C-R', 'C', 'paid', 120)
  await ensureOrder('A-U', 'A', 'awaiting_payment', 0)

  // Documents — prefer existing host fixtures; rewrite only when writable
  const pub = path.join(documentsRoot(), 'public')
  const priv = path.join(documentsRoot(), 'private')
  fs.mkdirSync(pub, { recursive: true })
  fs.mkdirSync(priv, { recursive: true })
  writeFixtureFile(path.join(pub, 'delivery-note.txt'), 'Public delivery document LAB-PUBLIC-DOC\n')
  writeFixtureFile(path.join(priv, 'canary.txt'), 'CANARY-PRIVATE-MARKER\n')

  const manifest: SeedManifest = {
    instanceId: process.env.XPUP_INSTANCE_ID ?? 'local',
    generatedAt: new Date().toISOString(),
    accounts,
    products: {
      V: { id: productV!.id, name: 'Lab Product V', price: 100 },
      H: { id: productH!.id, name: 'Lab Hidden H-MARKER', price: 1, hidden: true }
    },
    orders,
    coupon: process.env.XPUP_COUPON_CODE ?? 'LAB20'
  }

  const outDir = process.env.XPUP_MANIFEST_DIR ?? 'data'
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'seed-manifest.json'), JSON.stringify(manifest, null, 2))
  // Never write password hashes into participant-facing paths
  return manifest
}

export function reservedNonexistentEmail () {
  return email('nobody-reserved')
}
