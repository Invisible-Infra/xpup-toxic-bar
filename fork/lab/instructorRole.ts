/**
 * XPUP-LAB: Instructor-only role change for fixture T.
 * Allowlist is fixed. This is not a SQL console.
 */
import { QueryTypes, Sequelize } from 'sequelize'

const EMAIL = 't@lab.test'
const ROLES = new Set(['customer', 'support'])

async function main () {
  const email = process.argv[2]
  const role = process.argv[3]
  if (email !== EMAIL || !ROLES.has(role)) {
    console.error('rejected')
    process.exit(2)
  }
  const storage = process.env.XPUP_SQLITE_PATH || '/instance/data/juiceshop.sqlite'
  const sequelize = new Sequelize('database', 'username', 'password', {
    dialect: 'sqlite',
    storage,
    logging: false
  })
  try {
    await sequelize.query('PRAGMA busy_timeout = 5000')
    const users = await sequelize.query<{ id: number }>(
      'SELECT id FROM Users WHERE email = ? AND deletedAt IS NULL',
      { replacements: [email], type: QueryTypes.SELECT }
    )
    if (!users.length) {
      console.error('user not found')
      process.exit(3)
    }
    const id = users[0].id
    await sequelize.query('UPDATE Users SET role = ? WHERE id = ?', { replacements: [role, id] })
    await sequelize.query(
      'UPDATE SessionRecords SET revoked = 1 WHERE UserId = ? AND revoked = 0',
      { replacements: [id] }
    )
    console.log('ok')
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'db')
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

void main()
