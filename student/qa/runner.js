'use strict'
/*
 * Local XPUP acceptance. Runs against the existing student test deployment.
 * The tests are mapped to docs/TEST_PLAN.md; a PASS is a tested subset,
 * NOT a claim that every individual AC or browser teaching path is covered.
 */
const fs = require('node:fs')
const crypto = require('node:crypto')
const http = require('node:http')
const APP = process.env.APP_URL || 'http://app:3000'
const MAIL = process.env.MAIL_URL || 'http://mailbox:8080'
const phase = process.argv[2] || 'main'
const results = []
const PW = {
  A: 'LabPasswordA15chars!', B: 'LabPasswordB15chars!',
  C: 'LabPasswordC15chars!', T: 'LabPasswordT15chars!',
  S: 'LabPasswordS15chars!', P: 'LabPasswordP15chars!',
  W: 'LabPasswordW15chars!'
}
const MARKER = 'qa-reset-marker@lab.test'
const MARKER_PW = 'QaResetMarkerPassword15!'
const QA_L2 = 'qa-recovery@lab.test'
const QA_MFA = 'qa-mfa@lab.test'

function assert(condition, message) {
  if (!condition) throw Error(message || 'assertion failed')
}
function eq(actual, expected, message) {
  assert(actual === expected, (message || 'mismatch') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual))
}
function goodStatus(res, allowed, label) {
  assert(allowed.includes(res.status), (label || 'HTTP') + ': ' + res.status + ' ' + res.text.slice(0, 180))
}
async function request(route, opts = {}) {
  const headers = { ...(opts.headers || {}) }
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token
  let body
  if (opts.form) {
    body = opts.form
  } else if (opts.data !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.data)
  }
  const response = await fetch((opts.base || APP) + route, {
    method: opts.method || 'GET', headers, body,
    signal: AbortSignal.timeout(opts.timeout || 12000)
  })
  const text = await response.text()
  let data
  try { data = JSON.parse(text) } catch { data = {} }
  return { status: response.status, data, text, headers: response.headers }
}
async function login(who, pass) {
  const email = who.includes('@') ? who : who.toLowerCase() + '@lab.test'
  const pwd = pass || PW[who.toUpperCase()]
  const res = await request('/rest/user/login', { method: 'POST', data: { email, password: pwd } })
  goodStatus(res, [200], 'login ' + email)
  assert(res.data.authentication && res.data.authentication.token, 'login token missing')
  return res.data.authentication.token
}
async function register(email, password) {
  return request('/api/Users', { method: 'POST', data: { email, password, passwordRepeat: password } })
}
// Node's fetch does not reliably set Host for this internal mailbox URL.
// Use http.request to reach the container but send the loopback Host
// required by the student-facing mailbox, without relaxing its guard.
async function mailboxGet(route) {
  return new Promise((resolve, reject) => {
    const req = http.get(new URL(route, MAIL), {
      headers: { Host: '127.0.0.1:3080' },
      timeout: 12000
    }, res => {
      const parts = []
      res.on('data', chunk => parts.push(chunk))
      res.on('end', () => resolve({
        status: res.statusCode,
        text: Buffer.concat(parts).toString('utf8')
      }))
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('mailbox timeout')))
    req.on('error', reject)
  })
}
async function mailbox() {
  const res = await mailboxGet('/')
  goodStatus(res, [200], 'mailbox')
  return res.text
}
async function mailFor(email) {
  const html = await mailbox()
  const matches = [...html.matchAll(/href="(\/m\/[^"]+)"/g)]
  const href = matches.map(m => m[1]).find(s => decodeURIComponent(s).includes(email))
  assert(href, 'mailbox does not contain email ' + email)
  const res = await mailboxGet(href)
  goodStatus(res, [200], 'mail text')
  return res.text
}
async function check(name, fn) {
  try {
    await fn()
    results.push({ name, result: 'PASS' })
    console.log('PASS ' + name)
  } catch (err) {
    results.push({ name, result: 'FAIL', detail: String(err.message || err) })
    console.log('FAIL ' + name + ' :: ' + String(err.message || err))
  }
}
function skip(name, why) {
  results.push({ name, result: 'SKIP', detail: why })
  console.log('SKIP ' + name + ' :: ' + why)
}
async function waitHealthy() {
  const end = Date.now() + 120000
  let last = ''
  while (Date.now() < end) {
    try {
      const a = await request('/')
      const m = await mailbox()
      if (a.status === 200 && m.includes('Lokální schránka')) return
      last = 'app=' + a.status
    } catch (e) { last = e.message }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw Error('QA stack not ready: ' + last)
}
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of secret.toUpperCase().replace(/=+$/g, '')) {
    const index = alphabet.indexOf(c)
    if (index < 0) throw Error('invalid base32')
    bits += index.toString(2).padStart(5, '0')
  }
  const key = Buffer.alloc(Math.floor(bits.length / 8))
  for (let i = 0; i < key.length; i++) key[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const mac = crypto.createHmac('sha1', key).update(counter).digest()
  const offset = mac[mac.length - 1] & 15
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}
async function mainTests() {
  await check('L1 branding and challenge surface', async () => {
    const c = await request('/rest/admin/application-configuration')
    goodStatus(c, [200])
    eq(c.data.config?.application?.name ?? c.data.application?.name, 'Toxic Bar')
    goodStatus(await request('/api/Challenges'), [404])
    goodStatus(await request('/rest/chat', { method: 'POST', data: { message: 'hi' } }), [404])
  })
  await check('L1 feedback rating 6 persists; rating 0 denied', async () => {
    const captcha = (await request('/rest/captcha')).data
    assert(captcha.captchaId !== undefined && captcha.answer !== undefined, 'captcha missing')
    const note = 'qa-feedback-six'
    const yes = await request('/api/Feedbacks', { method: 'POST', data: {
      comment: note, rating: 6, captchaId: captcha.captchaId, captcha: captcha.answer
    } })
    goodStatus(yes, [200, 201])
    const noCaptcha = (await request('/rest/captcha')).data
    const no = await request('/api/Feedbacks', { method: 'POST', data: {
      comment: 'qa-feedback-zero', rating: 0, captchaId: noCaptcha.captchaId, captcha: noCaptcha.answer
    } })
    assert(no.status >= 400, 'rating 0 accepted')
    const listing = await request('/api/Feedbacks')
    assert(listing.text.includes(note), 'accepted feedback not stored')
    assert(!listing.text.includes('qa-feedback-zero'), 'denied feedback stored')
  })
  await check('L2 registration, duplicate and password policy', async () => {
    goodStatus(await register(MARKER, MARKER_PW), [201])
    await login(MARKER, MARKER_PW)
    assert((await register(MARKER, MARKER_PW)).status >= 400, 'duplicate accepted')
    assert((await register('qa-short@lab.test', 'short')).status >= 400, 'short password accepted')
  })
  await check('L2 reset enumeration, mailbox and reusable token', async () => {
    goodStatus(await register(QA_L2, 'QaRecoveryPassword15!'), [201])
    goodStatus(await request('/rest/user/reset-link', { method: 'POST', data: { email: QA_L2 } }), [200])
    const unknown = await request('/rest/user/reset-link', { method: 'POST', data: { email: 'nobody-reserved@lab.test' } })
    goodStatus(unknown, [404])
    const mail = await mailFor(QA_L2)
    const token = mail.match(/token=([a-f0-9]{64})/)?.[1]
    assert(token, 'reset token not in mailbox')
    for (const password of ['QaRecoveryNextPassword15!', 'QaRecoveryThirdPassword15!']) {
      goodStatus(await request('/rest/user/reset-password-token', {
        method: 'POST', data: { token, password, repeat: password }
      }), [200])
      await login(QA_L2, password)
    }
    assert((await request('/rest/user/reset-password-token', {
      method: 'POST', data: { token: '0'.repeat(64), password: 'UnknownPassword15!' }
    })).status >= 400, 'unknown reset token accepted')
  })
  await check('L2 no login throttle after twelve failures', async () => {
    for (let i = 0; i < 12; i++) {
      goodStatus(await request('/rest/user/login', { method: 'POST',
        data: { email: 'c@lab.test', password: 'wrong-' + i + '-password-15!' }
      }), [401])
    }
    await login('C')
  })
  await check('L2 MFA enrollment and second-factor login', async () => {
    const pwd = 'QaMfaPassword15!'
    goodStatus(await register(QA_MFA, pwd), [201])
    const token = await login(QA_MFA, pwd)
    const setup = await request('/rest/2fa/status', { token })
    goodStatus(setup, [200])
    assert(setup.data.secret && setup.data.setupToken, 'MFA setup data missing')
    goodStatus(await request('/rest/2fa/setup', { method: 'POST', token, data: {
      password: pwd, setupToken: setup.data.setupToken, initialToken: totp(setup.data.secret)
    } }), [200])
    const passwordOnly = await request('/rest/user/login', { method: 'POST', data: { email: QA_MFA, password: pwd } })
    goodStatus(passwordOnly, [401])
    eq(passwordOnly.data.status, 'totp_token_required')
    goodStatus(await request('/rest/2fa/verify', { method: 'POST', data: {
      tmpToken: passwordOnly.data.data.tmpToken, totpToken: totp(setup.data.secret)
    } }), [200])
  })
  await check('L3 unique sessions and logout token replay', async () => {
    const first = await login('B')
    const second = await login('B')
    assert(first !== second, 'duplicate session tokens')
    goodStatus(await request('/rest/user/logout', { method: 'POST', token: first, data: {} }), [200])
    const who = await request('/rest/user/whoami', { token: first })
    goodStatus(who, [200])
    eq(who.data.user?.email, 'b@lab.test')
  })
  await check('L4/L6 address GET IDOR, PUT restriction and audit restriction', async () => {
    const a = await login('A')
    const b = await login('B')
    const addresses = await request('/api/Addresss', { token: b })
    goodStatus(addresses, [200])
    const row = addresses.data.data.find(r => r.fullName === 'ADDRESS-B-MARKER')
    assert(row, 'B address missing')
    const stolenRead = await request('/api/Addresss/' + row.id, { token: a })
    goodStatus(stolenRead, [200])
    eq(stolenRead.data.data?.fullName, 'ADDRESS-B-MARKER')
    goodStatus(await request('/api/Addresss/' + row.id, {
      method: 'PUT', token: a, data: { fullName: 'TAKEN-BY-A' }
    }), [403])
    goodStatus(await request('/rest/support/orders/audit', { token: a }), [403])
    goodStatus(await request('/rest/support/orders/order-c-r/refund', { method: 'POST', token: a }), [403])
  })
  await check('L4/L6 staff refund C-R and second refund denied', async () => {
    const s = await login('S')
    goodStatus(await request('/rest/support/orders/audit', { token: s }), [200])
    goodStatus(await request('/rest/support/orders/order-c-r/refund', { method: 'POST', token: s }), [200])
    assert((await request('/rest/support/orders/order-c-r/refund', { method: 'POST', token: s })).status >= 400, 'double refund accepted')
  })
  await check('L5 isVip accepted, wallet and role writes denied', async () => {
    const w = await login('W')
    const before = await request('/rest/lab/profile', { token: w })
    goodStatus(before, [200])
    eq(before.data.data.isVip, false)
    eq(before.data.data.balance, 500)
    const changed = await request('/rest/lab/profile', { method: 'PUT', token: w, data: { isVip: true } })
    goodStatus(changed, [200])
    eq(changed.data.data.isVip, true)
    for (const body of [{ balance: 1 }, { role: 'support' }, { wallet: 999 }]) {
      goodStatus(await request('/rest/lab/profile', { method: 'PUT', token: w, data: body }), [400])
    }
    const after = await request('/rest/lab/profile', { token: w })
    eq(after.data.data.balance, 500)
    eq(after.data.data.role, 'customer')
  })
  await check('L7 SQLi H marker and Users isolation', async () => {
    const path = '/rest/products/search?q='
    const normal = await request(path + encodeURIComponent('Lab Hidden H-MARKER'))
    goodStatus(normal, [200])
    assert(!JSON.stringify(normal.data).includes('Lab Hidden H-MARKER'), 'hidden item publicly visible')
    const attack = await request(path + encodeURIComponent("')) OR 1=1--"))
    goodStatus(attack, [200])
    assert(JSON.stringify(attack.data).includes('Lab Hidden H-MARKER'), 'SQLi not observable')
    const users = await request(path + encodeURIComponent("')) UNION SELECT id,email,password,password,password,password,password,password,password FROM Users--"))
    assert(users.status >= 400 && !users.text.includes('a@lab.test'), 'account database leaked')
  })
  await check('L7 stored ticket HTML and access control', async () => {
    const a = await login('A')
    const b = await login('B')
    const s = await login('S')
    const created = await request('/rest/support/tickets', { method: 'POST', token: a, data: {
      message: '<img src=x id="qa-ticket">', previewTitle: '<script>title</script>'
    } })
    goodStatus(created, [201])
    const path = '/rest/support/tickets/' + created.data.data.id + '?format=html'
    goodStatus(await request(path, { token: b }), [403])
    const page = await request(path, { token: s })
    goodStatus(page, [200])
    assert(page.text.includes('<img src=x id="qa-ticket">'), 'stored message escaped')
    assert(page.text.includes('&lt;script&gt;title&lt;/script&gt;'), 'preview title not escaped')
  })
  await check('L7 document traversal within fixture root only', async () => {
    const ok = await request('/rest/document?ref=' + encodeURIComponent('../private/canary.txt'))
    goodStatus(ok, [200])
    assert(ok.text.includes('CANARY-PRIVATE-MARKER'), 'canary missing')
    assert((await request('/rest/document?ref=' + encodeURIComponent('../../../../etc/passwd'))).status >= 400,
      'out-of-fixture traversal succeeded')
  })
  await check('L8 misleading PNG upload lifecycle', async () => {
    const a = await login('A')
    const form = new FormData()
    form.append('file', new Blob(['this is not PNG'], { type: 'image/png' }), 'note.png')
    const uploaded = await request('/rest/uploads', { method: 'POST', token: a, form })
    goodStatus(uploaded, [201])
    eq(uploaded.data.data.previewStatus, 'unavailable')
    const handle = uploaded.data.data.handle
    const status = await request('/rest/uploads/' + handle, { token: a })
    goodStatus(status, [200])
    eq(status.data.data.previewStatus, 'unavailable')
    const download = await request('/rest/uploads/' + handle + '/download', { token: a })
    goodStatus(download, [200])
    assert(download.text.includes('this is not PNG'), 'stored bytes changed')
    goodStatus(await request('/rest/uploads/' + handle, { method: 'DELETE', token: a }), [200])
    goodStatus(await request('/rest/uploads/' + handle, { token: a }), [404])
  })
  await check('L8 SSRF public, canary, and external deny', async () => {
    const a = await login('A')
    for (const [url, title] of [
      ['http://fixture-public/', 'Produkt V'],
      ['http://fixture-canary/', 'INTERNAL-CANARY-MARKER']
    ]) {
      const r = await request('/rest/url-preview', { method: 'POST', token: a, data: { url } })
      goodStatus(r, [200])
      eq(r.data.data?.title, title)
    }
    const denied = await request('/rest/url-preview', { method: 'POST', token: a, data: { url: 'http://example.com/' } })
    goodStatus(denied, [502])
    assert(denied.text.includes('host not allowed'), 'unexpected external fetch behavior')
  })
  await check('L9 double coupon and wallet 500 to 420', async () => {
    const p = await login('P')
    const product = await request('/rest/products/search?q=' + encodeURIComponent('Lab Product V'))
    const productId = product.data.data.find(x => x.name === 'Lab Product V')?.id
    assert(productId, 'product V not seeded')
    const redemptions = []
    for (let i = 0; i < 2; i++) {
      const r = await request('/rest/lab/coupon', { method: 'POST', token: p, data: { code: 'LAB20' } })
      goodStatus(r, [200])
      redemptions.push(r.data.data)
    }
    eq(redemptions[1].discount, 40)
    const addr = await request('/api/Addresss', { method: 'POST', token: p, data: {
      fullName: 'QA P', mobileNum: 1234567890, zipCode: '10000', streetAddress: 'Lab 1', city: 'Lab', country: 'CZ'
    } })
    goodStatus(addr, [200, 201])
    const delivery = await request('/api/Deliverys')
    const deliveryMethodId = delivery.data.data[0]?.id
    const addressId = addr.data.data?.id ?? addr.data.id
    assert(addressId && deliveryMethodId, 'checkout fixtures missing')
    const order = await request('/rest/lab/orders', { method: 'POST', token: p, data: {
      productId, quantity: 1, unitPrice: 100, addressId, deliveryMethodId
    } })
    goodStatus(order, [201])
    eq(order.data.data.total, 80)
    goodStatus(await request('/rest/orders/' + order.data.data.publicId + '/pay-wallet', { method: 'POST', token: p }), [200])
    const profile = await request('/rest/lab/profile', { token: p })
    eq(profile.data.data.balance, 420)
  })
  await check('L9 confirm without payment and client unitPrice', async () => {
    const a = await login('A')
    const b = await login('B')
    const product = await request('/rest/products/search?q=' + encodeURIComponent('Lab Product V'))
    const productId = product.data.data.find(x => x.name === 'Lab Product V')?.id
    const quote = await request('/rest/checkout/quote', { method: 'POST', token: b,
      data: { productId, quantity: 1, unitPrice: 1 } })
    goodStatus(quote, [200])
    eq(quote.data.data.total, 21)
    const addresses = await request('/api/Addresss', { token: a })
    const addressId = addresses.data.data.find(x => x.fullName === 'ADDRESS-A-MARKER')?.id
    const delivery = await request('/api/Deliverys')
    const deliveryMethodId = delivery.data.data[0]?.id
    const order = await request('/rest/lab/orders', { method: 'POST', token: a,
      data: { productId, quantity: 1, unitPrice: 100, addressId, deliveryMethodId } })
    goodStatus(order, [201])
    eq(order.data.data.paidAmount, 0)
    const confirmed = await request('/rest/orders/' + order.data.data.publicId + '/confirm',
      { method: 'POST', token: a })
    goodStatus(confirmed, [200])
    eq(confirmed.data.data.paidAmount, 0)
    eq(confirmed.data.data.status, 'confirmed')
  })
  await check('O-SSRF negative and mailbox host restriction', async () => {
    const a = await login('A')
    const denied = await request('/rest/url-preview', { method: 'POST', token: a,
      data: { url: 'http://host.docker.internal/' } })
    goodStatus(denied, [502])
    const forbiddenHost = await request('/', { base: MAIL })
    goodStatus(forbiddenHost, [403])
  })
  skip('L1 browser teaching-path rehearsal', 'Requires real Firefox DevTools and human QA')
  skip('Full remaining ACs L1-L9', 'Targeted smoke/regression subset, not exhaustive docs/TEST_PLAN.md')
  skip('O-PEER separate student machines', 'Requires external peer/network topology')
  skip('Windows/macOS runtime', 'Must execute on actual target platforms')
}

async function rolePrepare() {
  await check('L3 role change fixture preparation', async () => {
    const t = await login('T')
    const s = await login('S')
    fs.writeFileSync('/qa-state/role.json', JSON.stringify({ t, s }), { mode: 0o600 })
    goodStatus(await request('/rest/user/whoami', { token: t }), [200])
  })
}
async function roleCheck() {
  await check('L3 role change revokes T, retains S', async () => {
    const { t, s } = JSON.parse(fs.readFileSync('/qa-state/role.json', 'utf8'))
    // /rest/user/whoami deliberately returns 200 with an empty user for
    // an invalid/revoked session. The protected profile must return 401.
    const oldT = await request('/rest/user/whoami', { token: t })
    goodStatus(oldT, [200])
    assert(!oldT.data.user?.id && !oldT.data.user?.email,
      'T old session still identifies the account: ' + JSON.stringify(oldT.data))
    goodStatus(await request('/rest/lab/profile', { token: t }), [401],
      'T old session still opens protected profile')
    const newer = await login('T')
    const profile = await request('/rest/lab/profile', { token: newer })
    eq(profile.data.data.role, 'customer', 'T new role')
    const other = await request('/rest/user/whoami', { token: s })
    goodStatus(other, [200])
    eq(other.data.user?.email, 's@lab.test')
  })
}
async function persisted() {
  await check('O-RESTART marker user survives app restart', async () => { await login(MARKER, MARKER_PW) })
  await check('O-RESTART VIP state and mailbox survive app restart', async () => {
    const w = await login('W')
    eq((await request('/rest/lab/profile', { token: w })).data.data.isVip, true)
    const email = await mailFor(QA_L2)
    assert(email.includes('Reset link:'), 'mail lost')
  })
}
async function reset() {
  await check('O-RESET fresh seeded account A', async () => { await login('A') })
  await check('O-RESET temporary user and prior mailbox cleared', async () => {
    const attempt = await request('/rest/user/login', { method: 'POST',
      data: { email: MARKER, password: MARKER_PW } })
    goodStatus(attempt, [401])
    assert(!(await mailbox()).includes('qa-recovery@lab.test.eml'), 'old mailbox retained')
  })
  await check('O-RESET initial roles, VIP and order state', async () => {
    const w = await login('W')
    const p = await login('P')
    const t = await login('T')
    eq((await request('/rest/lab/profile', { token: w })).data.data.isVip, false)
    eq((await request('/rest/lab/profile', { token: t })).data.data.role, 'support')
    eq((await request('/rest/lab/profile', { token: p })).data.data.balance, 500)
    const history = await request('/rest/lab/orders', { token: p })
    assert(history.data.data.length === 0, 'test orders survived reset')
  })
}
async function run() {
  await waitHealthy()
  console.log('=== XPUP local QA phase: ' + phase + ' ===')
  if (phase === 'main') await mainTests()
  else if (phase === 'role-prepare') await rolePrepare()
  else if (phase === 'role-check') await roleCheck()
  else if (phase === 'persist') await persisted()
  else if (phase === 'reset') await reset()
  else if (phase !== 'wait') throw Error('Unknown phase ' + phase)
  const counts = { PASS: 0, FAIL: 0, SKIP: 0 }
  for (const x of results) counts[x.result]++
  console.log('SUMMARY ' + JSON.stringify({ phase, ...counts }))
  if (counts.FAIL) process.exitCode = 1
}
run().catch(e => { console.error('FATAL ' + String(e.stack || e)); process.exitCode = 1 })
