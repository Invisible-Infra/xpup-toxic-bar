/**
 * XPUP-LAB: full product copy used by search. The live query runs in catalog-worker
 * when XPUP_CATALOG_WORKER_URL is set, so the search process cannot open the account database.
 */
import fs from 'node:fs'
import path from 'node:path'
import { Sequelize } from 'sequelize'
import { ProductModel } from '../models/product'

export function catalogPath () {
  if (process.env.XPUP_CATALOG_PATH) return process.env.XPUP_CATALOG_PATH
  const main = process.env.XPUP_SQLITE_PATH ?? path.join('data', 'juiceshop.sqlite')
  return path.join(path.dirname(main), 'catalog', 'catalog.sqlite')
}

export async function refreshCatalog () {
  const dest = catalogPath()
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const products = await ProductModel.findAll({ paranoid: false })
  const tmp = `${dest}.tmp`
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
  const db = new Sequelize({ dialect: 'sqlite', storage: tmp, logging: false })
  try {
    await db.query(`CREATE TABLE Products (
      id INTEGER PRIMARY KEY,
      name TEXT,
      description TEXT,
      price REAL,
      deluxePrice REAL,
      image TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      deletedAt TEXT
    )`)
    for (const product of products) {
      const row = product.get({ plain: true }) as any
      await db.query(
        'INSERT INTO Products (id, name, description, price, deluxePrice, image, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        { replacements: [
          row.id,
          row.name,
          row.description,
          Number(row.price),
          Number(row.deluxePrice),
          row.image,
          row.createdAt ? String(row.createdAt) : null,
          row.updatedAt ? String(row.updatedAt) : null,
          row.deletedAt ? String(row.deletedAt) : null
        ] }
      )
    }
  } finally {
    await db.close()
  }
  fs.renameSync(tmp, dest)
}

export async function queryCatalog (criteria: string): Promise<any[]> {
  const url = process.env.XPUP_CATALOG_WORKER_URL
  if (url) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: criteria })
    })
    const body = await response.json().catch(() => ({})) as { data?: any[], message?: string }
    if (!response.ok) {
      throw new Error(body.message || 'search failed')
    }
    return body.data ?? []
  }
  if (!fs.existsSync(catalogPath())) return []
  const db = new Sequelize({ dialect: 'sqlite', storage: catalogPath(), logging: false })
  try {
    await db.query('PRAGMA query_only = ON')
    const [rows] = await db.query(
      `SELECT * FROM Products WHERE ((name LIKE '%${criteria}%' OR description LIKE '%${criteria}%') AND deletedAt IS NULL) ORDER BY name`
    )
    return rows as any[]
  } finally {
    await db.close()
  }
}
