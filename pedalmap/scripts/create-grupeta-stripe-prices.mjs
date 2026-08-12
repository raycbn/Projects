/**
 * Create Pack Grupeta Stripe product + prices (14,99 €/mo · 119,99 €/yr).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_… node scripts/create-grupeta-stripe-prices.mjs
 *   # or sk_test_… for sandbox
 *
 * Prints price ids to paste into workers/api/wrangler.toml:
 *   STRIPE_PRICE_GRUPETA_MONTHLY / STRIPE_PRICE_GRUPETA_YEARLY
 */
const key = process.env.STRIPE_SECRET_KEY?.trim()
if (!key) {
  console.error('Set STRIPE_SECRET_KEY (sk_live_… or sk_test_…)')
  process.exit(1)
}

const mode = key.startsWith('sk_live') ? 'live' : key.startsWith('sk_test') ? 'test' : 'unknown'
console.log('stripe_mode', mode)

async function form(path, params) {
  const body = new URLSearchParams(params)
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(json))
  return json
}

async function get(path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  return res.json()
}

const search = await get(
  'products/search?query=' + encodeURIComponent("name:'PedalMap Pack Grupeta'"),
)
let product = search.data?.[0]
if (!product) {
  product = await form('products', {
    name: 'PedalMap Pack Grupeta',
    description: '4 plazas Premium (tú + 3). Asignación de emails tras el pago.',
    'metadata[kind]': 'grupeta',
    'metadata[seatLimit]': '4',
  })
  console.log('created_product', product.id)
} else {
  console.log('existing_product', product.id)
}

const prices = await get(`prices?product=${product.id}&active=true&limit=20`)
const byInterval = Object.fromEntries((prices.data || []).map((p) => [p.recurring?.interval, p]))

async function ensurePrice(interval, unitAmount) {
  const existing = byInterval[interval]
  if (existing && existing.unit_amount === unitAmount && existing.currency === 'eur') {
    console.log(`price_${interval}`, existing.id, existing.unit_amount)
    return existing.id
  }
  const p = await form('prices', {
    product: product.id,
    currency: 'eur',
    unit_amount: String(unitAmount),
    'recurring[interval]': interval,
    'metadata[kind]': 'grupeta',
    'metadata[seatLimit]': '4',
  })
  console.log(`created_price_${interval}`, p.id, p.unit_amount)
  return p.id
}

const month = await ensurePrice('month', 1499)
const year = await ensurePrice('year', 11999)
console.log('\nPaste into wrangler.toml [vars]:')
console.log(`STRIPE_PRICE_GRUPETA_MONTHLY = "${month}"`)
console.log(`STRIPE_PRICE_GRUPETA_YEARLY = "${year}"`)
