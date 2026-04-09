import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────
const {
  SUPABASE_URL            = process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET              = 'dev-secret-change-me',
  APP_URL                 = 'http://localhost:5173',
  OMEGACASES_CLIENT_ID,
  OMEGACASES_CLIENT_SECRET,
  OMEGACASES_OAUTH_URL    = 'https://www.omegacases.com/oauth/authorize',
  OMEGACASES_TOKEN_URL    = 'https://www.omegacases.com/oauth/token',
  OMEGACASES_USER_URL     = 'https://www.omegacases.com/api/oauth/me',
} = process.env

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1491871730933960804/nDxMuzv2NJlcVYPu_K5X5qXSEk7ZXUUKQtGas-Pe3TfRDTYaLYY0oITOQE_1VY51upea'

// Supabase — use placeholder URLs so createClient never throws at cold start.
// Requests will 500 with a clear message if env vars aren't configured.
const supabase = createClient(
  SUPABASE_URL            || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
)

// ── App ───────────────────────────────────────────
const app = express()

// Allow the deployed Vercel URL as well as localhost
const ALLOWED_ORIGINS = [
  APP_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://omegaexchange.vercel.app',
  'https://exchange.omegacases.com',
].filter(Boolean)

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json())

// ── Auth middleware ────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    req.user = { id: payload.sub, username: payload.username }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

function requireAdmin(req, res, next) {
  if (!ADMIN_USER_IDS.includes(req.user.id)) {
    return res.status(403).json({ error: 'Admin only' })
  }
  next()
}

// ══════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════

// GET /api/auth/login — redirect to OmegaCases OAuth
app.get('/api/auth/login', (req, res) => {
  const params = new URLSearchParams({
    client_id:    OMEGACASES_CLIENT_ID || 'YOUR_CLIENT_ID',
    redirect_uri: `${APP_URL}/api/auth/callback`,
    scope:        'read_id,read_username,read_balance',
    state:        Math.random().toString(36).slice(2),
  })
  res.redirect(`${OMEGACASES_OAUTH_URL}?${params}`)
})

// GET /api/auth/callback — OmegaCases sends token + user_id + username in the redirect
app.get('/api/auth/callback', async (req, res) => {
  const { token, user_id, username, error } = req.query

  if (error)    return res.redirect(`${APP_URL}/auth/callback?error=${encodeURIComponent(error)}`)
  if (!token)   return res.redirect(`${APP_URL}/auth/callback?error=no_token`)
  if (!user_id) return res.redirect(`${APP_URL}/auth/callback?error=no_user_id`)

  try {
    const userId = String(user_id)
    const uname  = String(username)

    // Upsert user in DB
    const { error: upsertErr } = await supabase
      .from('users')
      .upsert({ id: userId, username: uname }, { onConflict: 'id', ignoreDuplicates: false })
    if (upsertErr) console.error('Upsert error:', upsertErr)

    // Ensure balance and reputation rows exist
    await supabase.from('balances').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    await supabase.from('reputation').upsert(
      { user_id: userId, total_trades: 0, successful_trades: 0, rating: 5.0 },
      { onConflict: 'user_id', ignoreDuplicates: true },
    )

    // Issue our own signed JWT
    const jwtToken = jwt.sign({ sub: userId, username: uname }, JWT_SECRET, { expiresIn: '30d' })
    res.redirect(`${APP_URL}/auth/callback?token=${jwtToken}`)
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.redirect(`${APP_URL}/auth/callback?error=${encodeURIComponent(err.message)}`)
  }
})

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('*, reputation(*), balances(*)')
    .eq('id', req.user.id)
    .single()
  if (error || !user) return res.status(404).json({ error: 'User not found' })
  res.json({ user })
})

// ══════════════════════════════════════════════════
//  OFFERS
// ══════════════════════════════════════════════════

// GET /api/offers
app.get('/api/offers', async (req, res) => {
  const { currency, payment_method, sort = 'price_asc' } = req.query

  let query = supabase
    .from('offers')
    .select('*, seller:users(id, username)')
    .eq('is_active', true)
    .gt('available_amount', 0)

  if (currency)       query = query.eq('currency', currency)
  if (payment_method) query = query.contains('payment_methods', [payment_method])

  if (sort === 'price_asc')  query = query.order('price', { ascending: true })
  if (sort === 'price_desc') query = query.order('price', { ascending: false })
  if (sort === 'newest')     query = query.order('created_at', { ascending: false })

  const { data, error } = await query.limit(50)
  if (error) {
    console.error('[GET /api/offers] error:', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ offers: data || [] })
})

// GET /api/offers/:id
app.get('/api/offers/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('offers')
    .select('*, seller:users(id, username)')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Offer not found' })
  res.json({ offer: data })
})

// POST /api/offers
app.post('/api/offers', requireAuth, async (req, res) => {
  const { currency, price, min_amount, max_amount, available_amount, payment_methods, payment_instructions } = req.body

  if (!currency || !price || !min_amount || !max_amount || !available_amount) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (min_amount > max_amount) {
    return res.status(400).json({ error: 'min_amount cannot exceed max_amount' })
  }

  const { data, error } = await supabase
    .from('offers')
    .insert({
      seller_id:            req.user.id,
      currency,
      price:                parseFloat(price),
      min_amount:           parseFloat(min_amount),
      max_amount:           parseFloat(max_amount),
      available_amount:     parseFloat(available_amount),
      payment_methods:      payment_methods || [],
      payment_instructions: payment_instructions || '',
      is_active:            true,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ offer: data })
})

// PUT /api/offers/:id
app.put('/api/offers/:id', requireAuth, async (req, res) => {
  const { data: offer } = await supabase.from('offers').select('seller_id').eq('id', req.params.id).single()
  if (!offer)                           return res.status(404).json({ error: 'Not found' })
  if (offer.seller_id !== req.user.id)  return res.status(403).json({ error: 'Forbidden' })

  const allowed = ['price', 'min_amount', 'max_amount', 'available_amount', 'payment_methods', 'payment_instructions', 'is_active']
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))

  const { data, error } = await supabase.from('offers').update(updates).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ offer: data })
})

// DELETE /api/offers/:id
app.delete('/api/offers/:id', requireAuth, async (req, res) => {
  const { data: offer } = await supabase.from('offers').select('seller_id').eq('id', req.params.id).single()
  if (!offer)                           return res.status(404).json({ error: 'Not found' })
  if (offer.seller_id !== req.user.id)  return res.status(403).json({ error: 'Forbidden' })

  await supabase.from('offers').update({ is_active: false }).eq('id', req.params.id)
  res.json({ message: 'Offer deactivated' })
})

// ══════════════════════════════════════════════════
//  TRADES
// ══════════════════════════════════════════════════

// GET /api/trades
app.get('/api/trades', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('trades')
    .select(`
      *,
      buyer:users!trades_buyer_id_fkey(id, username),
      seller:users!trades_seller_id_fkey(id, username)
    `)
    .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ trades: data || [] })
})

// GET /api/trades/:id
app.get('/api/trades/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('trades')
    .select(`
      *,
      buyer:users!trades_buyer_id_fkey(id, username),
      seller:users!trades_seller_id_fkey(id, username),
      offer:offers(currency, payment_instructions)
    `)
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'Trade not found' })
  if (data.buyer_id !== req.user.id && data.seller_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Attach currency and payment instructions from offer
  const trade = {
    ...data,
    currency:             data.offer?.currency || 'BTC',
    payment_instructions: data.offer?.payment_instructions || '',
  }
  res.json({ trade })
})

// POST /api/trades — create trade (locks escrow)
app.post('/api/trades', requireAuth, async (req, res) => {
  const { offer_id, amount } = req.body
  if (!offer_id || !amount) return res.status(400).json({ error: 'offer_id and amount required' })

  // Load offer
  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offer_id)
    .eq('is_active', true)
    .single()

  if (offerErr || !offer) return res.status(404).json({ error: 'Offer not found or inactive' })
  if (offer.seller_id === req.user.id) return res.status(400).json({ error: 'Cannot buy your own offer' })

  const usdAmount   = parseFloat(amount)
  const cryptoAmount = usdAmount / offer.price

  if (usdAmount < offer.min_amount) return res.status(400).json({ error: `Minimum order is $${offer.min_amount}` })
  if (usdAmount > offer.max_amount) return res.status(400).json({ error: `Maximum order is $${offer.max_amount}` })
  if (cryptoAmount > offer.available_amount) return res.status(400).json({ error: 'Insufficient available amount' })

  // Check buyer's USD balance
  const { data: balance } = await supabase.from('balances').select('usd_balance').eq('user_id', req.user.id).single()
  if (!balance || balance.usd_balance < usdAmount) {
    return res.status(400).json({ error: 'Insufficient USD balance. Please deposit funds first.' })
  }

  // Deduct buyer balance (hold in escrow)
  await supabase
    .from('balances')
    .update({ usd_balance: balance.usd_balance - usdAmount })
    .eq('user_id', req.user.id)

  // Reduce available amount on offer
  await supabase
    .from('offers')
    .update({ available_amount: offer.available_amount - cryptoAmount })
    .eq('id', offer_id)

  // Create trade
  const { data: trade, error: tradeErr } = await supabase
    .from('trades')
    .insert({
      offer_id,
      buyer_id:      req.user.id,
      seller_id:     offer.seller_id,
      amount:        cryptoAmount,
      usd_amount:    usdAmount,
      price:         offer.price,
      currency:      offer.currency,
      status:        'pending',
      escrow_locked: true,
    })
    .select()
    .single()

  if (tradeErr) {
    // Refund on failure
    await supabase.from('balances').update({ usd_balance: balance.usd_balance }).eq('user_id', req.user.id)
    return res.status(500).json({ error: tradeErr.message })
  }

  // Notify seller
  await supabase.from('notifications').insert({
    user_id:      offer.seller_id,
    title:        'New Trade Started',
    message:      `Someone wants to buy ${cryptoAmount.toFixed(6)} ${offer.currency} from you.`,
    type:         'trade',
    reference_id: trade.id,
  }).catch(() => {})

  res.status(201).json({ trade, message: 'Trade created. Crypto locked in escrow.' })
})

// PATCH /api/trades/:id/confirm-payment
app.patch('/api/trades/:id/confirm-payment', requireAuth, async (req, res) => {
  const { data: trade } = await supabase.from('trades').select('*').eq('id', req.params.id).single()
  if (!trade)                        return res.status(404).json({ error: 'Not found' })
  if (trade.buyer_id !== req.user.id) return res.status(403).json({ error: 'Only buyer can confirm payment' })
  if (trade.status !== 'pending')    return res.status(400).json({ error: `Trade is ${trade.status}` })

  const { data, error } = await supabase
    .from('trades')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Notify seller
  await supabase.from('notifications').insert({
    user_id: trade.seller_id, title: 'Payment Confirmed',
    message: 'Buyer has confirmed payment. Please verify and release crypto.',
    type: 'trade', reference_id: trade.id,
  }).catch(() => {})

  res.json({ trade: data, message: 'Payment confirmed. Waiting for seller to release.' })
})

// PATCH /api/trades/:id/release — seller releases crypto
app.patch('/api/trades/:id/release', requireAuth, async (req, res) => {
  const { data: trade } = await supabase.from('trades').select('*').eq('id', req.params.id).single()
  if (!trade)                         return res.status(404).json({ error: 'Not found' })
  if (trade.seller_id !== req.user.id) return res.status(403).json({ error: 'Only seller can release' })
  if (trade.status !== 'paid')        return res.status(400).json({ error: 'Trade must be in "paid" status' })

  // Transfer USD to seller
  const { data: sellerBalance } = await supabase.from('balances').select('usd_balance').eq('user_id', req.user.id).single()
  const newSellerBal = (sellerBalance?.usd_balance ?? 0) + (trade.usd_amount || trade.amount * trade.price)
  await supabase.from('balances').upsert({ user_id: req.user.id, usd_balance: newSellerBal }, { onConflict: 'user_id' })

  // Credit crypto to buyer (tracked in DB)
  await supabase.from('crypto_holdings').upsert({
    user_id:  trade.buyer_id,
    currency: trade.currency,
  }, { onConflict: 'user_id,currency' })
  await supabase.rpc('increment_crypto_balance', {
    p_user_id:  trade.buyer_id,
    p_currency: trade.currency,
    p_amount:   trade.amount,
  }).catch(() => {}) // RPC may not exist yet — safe to ignore

  // Complete trade
  const { data, error } = await supabase
    .from('trades')
    .update({ status: 'completed', escrow_locked: false, completed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Update reputation
  await Promise.all([
    supabase.rpc('increment_trade_stats', { p_user_id: trade.buyer_id }).catch(() => {}),
    supabase.rpc('increment_trade_stats', { p_user_id: trade.seller_id }).catch(() => {}),
  ])

  // Notify buyer
  await supabase.from('notifications').insert({
    user_id: trade.buyer_id, title: 'Crypto Released!',
    message: `${trade.amount} ${trade.currency} has been released to your account.`,
    type: 'trade', reference_id: trade.id,
  }).catch(() => {})

  res.json({ trade: data, message: 'Crypto released. Trade complete!' })
})

// PATCH /api/trades/:id/dispute
app.patch('/api/trades/:id/dispute', requireAuth, async (req, res) => {
  const { reason } = req.body
  const { data: trade } = await supabase.from('trades').select('*').eq('id', req.params.id).single()
  if (!trade) return res.status(404).json({ error: 'Not found' })
  if (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  if (!['pending', 'paid'].includes(trade.status)) return res.status(400).json({ error: 'Cannot dispute this trade' })
  if (!reason?.trim()) return res.status(400).json({ error: 'Reason required' })

  await supabase.from('disputes').insert({
    trade_id:   req.params.id,
    opened_by:  req.user.id,
    reason,
    status:     'open',
  })

  const { data, error } = await supabase
    .from('trades')
    .update({ status: 'disputed' })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ trade: data, message: 'Dispute opened. Our team will review within 24 hours.' })
})

// PATCH /api/trades/:id/cancel
app.patch('/api/trades/:id/cancel', requireAuth, async (req, res) => {
  const { data: trade } = await supabase.from('trades').select('*').eq('id', req.params.id).single()
  if (!trade)                        return res.status(404).json({ error: 'Not found' })
  if (trade.buyer_id !== req.user.id) return res.status(403).json({ error: 'Only buyer can cancel' })
  if (trade.status !== 'pending')    return res.status(400).json({ error: 'Can only cancel pending trades' })

  // Refund buyer
  const { data: buyerBal } = await supabase.from('balances').select('usd_balance').eq('user_id', req.user.id).single()
  const usdBack = trade.usd_amount || trade.amount * trade.price
  await supabase.from('balances').update({ usd_balance: (buyerBal?.usd_balance ?? 0) + usdBack }).eq('user_id', req.user.id)

  // Restore offer amount
  await supabase.rpc('restore_offer_amount', {
    p_offer_id: trade.offer_id,
    p_amount:   trade.amount,
  }).catch(() => {
    // Fallback: manual restore
    supabase.from('offers').select('available_amount').eq('id', trade.offer_id).single()
      .then(({ data: o }) => {
        if (o) supabase.from('offers').update({ available_amount: o.available_amount + trade.amount }).eq('id', trade.offer_id)
      })
  })

  const { data, error } = await supabase
    .from('trades')
    .update({ status: 'cancelled', escrow_locked: false })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ trade: data, message: 'Trade cancelled. Funds refunded.' })
})

// ══════════════════════════════════════════════════
//  TRADE MESSAGES
// ══════════════════════════════════════════════════

// GET /api/trades/:id/messages
app.get('/api/trades/:id/messages', requireAuth, async (req, res) => {
  // Verify access
  const { data: trade } = await supabase.from('trades').select('buyer_id, seller_id').eq('id', req.params.id).single()
  if (!trade || (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data, error } = await supabase
    .from('trade_messages')
    .select('*, sender:users!trade_messages_sender_id_fkey(id, username)')
    .eq('trade_id', req.params.id)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ messages: data || [] })
})

// POST /api/trades/:id/messages
app.post('/api/trades/:id/messages', requireAuth, async (req, res) => {
  const { message } = req.body
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' })

  const { data: trade } = await supabase.from('trades').select('buyer_id, seller_id, status').eq('id', req.params.id).single()
  if (!trade || (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!['pending', 'paid'].includes(trade.status)) return res.status(400).json({ error: 'Trade closed' })

  const { data, error } = await supabase
    .from('trade_messages')
    .insert({ trade_id: req.params.id, sender_id: req.user.id, message: message.trim() })
    .select('*, sender:users!trade_messages_sender_id_fkey(id, username)')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ message: data })
})

// ══════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const uid = req.user.id

  const [tradesRes, balanceRes, repRes, depositsRes] = await Promise.all([
    supabase
      .from('trades')
      .select('*, buyer:users!trades_buyer_id_fkey(id,username), seller:users!trades_seller_id_fkey(id,username)')
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('balances').select('usd_balance').eq('user_id', uid).single(),
    supabase.from('reputation').select('*').eq('user_id', uid).single(),
    supabase.from('deposits').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
  ])

  const trades    = tradesRes.data    || []
  const balance   = balanceRes.data
  const rep       = repRes.data
  const deposits  = depositsRes.data  || []

  const completed = trades.filter(t => t.status === 'completed').length
  const total     = rep?.total_trades || trades.length
  const rate      = total > 0 ? Math.round((rep?.successful_trades || completed) / total * 100) : 100

  res.json({
    trades,
    deposits,
    stats: {
      usd_balance:       balance?.usd_balance ?? 0,
      total_trades:      total,
      completed_trades:  completed,
      completion_rate:   rate,
      rating:            rep?.rating ?? 5.0,
    },
  })
})

// ══════════════════════════════════════════════════
//  BALANCE & DEPOSITS
// ══════════════════════════════════════════════════

// GET /api/balance
app.get('/api/balance', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('balances').select('*').eq('user_id', req.user.id).single()
  if (error) return res.status(404).json({ error: 'Balance not found' })
  res.json({ balance: data })
})

// POST /api/deposits
app.post('/api/deposits', requireAuth, async (req, res) => {
  const { method, amount, reference } = req.body
  if (!method || !amount || !reference) return res.status(400).json({ error: 'method, amount, reference required' })
  if (!['paypal', 'giftcard'].includes(method)) return res.status(400).json({ error: 'Invalid method' })
  if (parseFloat(amount) < 5) return res.status(400).json({ error: 'Minimum deposit is $5' })

  const { data, error } = await supabase
    .from('deposits')
    .insert({
      user_id:   req.user.id,
      method,
      amount:    parseFloat(amount),
      reference: reference.trim(),
      status:    'pending',
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ deposit: data, message: 'Deposit submitted. Under review.' })
})

// GET /api/deposits
app.get('/api/deposits', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ deposits: data || [] })
})

// POST /api/withdrawals — user requests a withdrawal
app.post('/api/withdrawals', requireAuth, async (req, res) => {
  const { amount, paypal_address } = req.body
  if (!amount || !paypal_address) return res.status(400).json({ error: 'amount and paypal_address required' })
  const usd = parseFloat(amount)
  if (usd < 5) return res.status(400).json({ error: 'Minimum withdrawal is $5' })
  if (!paypal_address.includes('@')) return res.status(400).json({ error: 'Invalid PayPal address' })

  // Check balance
  const { data: bal } = await supabase.from('balances').select('usd_balance').eq('user_id', req.user.id).single()
  if (!bal || bal.usd_balance < usd) return res.status(400).json({ error: 'Insufficient balance' })

  // Deduct balance
  await supabase.from('balances').update({ usd_balance: bal.usd_balance - usd }).eq('user_id', req.user.id)

  // Insert withdrawal
  const { data: withdrawal, error } = await supabase
    .from('withdrawals')
    .insert({ user_id: req.user.id, amount: usd, paypal_address: paypal_address.trim(), status: 'pending' })
    .select()
    .single()

  if (error) {
    // Refund on failure
    await supabase.from('balances').update({ usd_balance: bal.usd_balance }).eq('user_id', req.user.id)
    return res.status(500).json({ error: error.message })
  }

  // Discord webhook
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '💸 Withdrawal Request',
          color: 0x3b82f6,
          fields: [
            { name: 'User',    value: req.user.username,   inline: true },
            { name: 'Amount',  value: `$${usd.toFixed(2)}`, inline: true },
            { name: 'PayPal',  value: paypal_address.trim(), inline: true },
          ],
          footer: { text: 'OmegaExchange' },
          timestamp: new Date().toISOString(),
        }],
      }),
    })
  } catch (err) {
    console.error('Discord webhook failed:', err)
  }

  res.status(201).json({ withdrawal, message: 'Withdrawal request submitted.' })
})

// GET /api/withdrawals — user's own withdrawals
app.get('/api/withdrawals', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ withdrawals: data || [] })
})

// ══ ADMIN ══════════════════════════════════════════

// GET /api/admin/deposits
app.get('/api/admin/deposits', requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('deposits')
    .select('*, user:users(id, username)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ deposits: data || [] })
})

// POST /api/admin/deposits/:id/approve
app.post('/api/admin/deposits/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const { data: dep, error: depErr } = await supabase
    .from('deposits').select('*').eq('id', req.params.id).single()
  if (depErr || !dep) return res.status(404).json({ error: 'Deposit not found' })
  if (dep.status !== 'pending') return res.status(400).json({ error: 'Already processed' })

  // Credit balance
  const { data: bal } = await supabase.from('balances').select('usd_balance').eq('user_id', dep.user_id).single()
  const current = bal?.usd_balance ?? 0
  await supabase.from('balances').upsert({ user_id: dep.user_id, usd_balance: current + dep.amount }, { onConflict: 'user_id' })

  // Mark approved
  await supabase.from('deposits').update({ status: 'approved' }).eq('id', req.params.id)
  res.json({ message: `Approved $${dep.amount} for user ${dep.user_id}` })
})

// POST /api/admin/deposits/:id/reject
app.post('/api/admin/deposits/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { data: dep } = await supabase.from('deposits').select('status').eq('id', req.params.id).single()
  if (!dep) return res.status(404).json({ error: 'Deposit not found' })
  if (dep.status !== 'pending') return res.status(400).json({ error: 'Already processed' })
  await supabase.from('deposits').update({ status: 'rejected' }).eq('id', req.params.id)
  res.json({ message: 'Deposit rejected' })
})

// GET /api/admin/withdrawals
app.get('/api/admin/withdrawals', requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*, user:users(id, username)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ withdrawals: data || [] })
})

// POST /api/admin/withdrawals/:id/complete
app.post('/api/admin/withdrawals/:id/complete', requireAuth, requireAdmin, async (req, res) => {
  const { data: w } = await supabase.from('withdrawals').select('status').eq('id', req.params.id).single()
  if (!w) return res.status(404).json({ error: 'Not found' })
  if (w.status !== 'pending') return res.status(400).json({ error: 'Already processed' })
  await supabase.from('withdrawals').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', req.params.id)
  res.json({ message: 'Marked as completed' })
})

// POST /api/admin/withdrawals/:id/reject
app.post('/api/admin/withdrawals/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { data: w } = await supabase.from('withdrawals').select('*').eq('id', req.params.id).single()
  if (!w) return res.status(404).json({ error: 'Not found' })
  if (w.status !== 'pending') return res.status(400).json({ error: 'Already processed' })

  // Refund balance
  const { data: bal } = await supabase.from('balances').select('usd_balance').eq('user_id', w.user_id).single()
  await supabase.from('balances').update({ usd_balance: (bal?.usd_balance ?? 0) + w.amount }).eq('user_id', w.user_id)
  await supabase.from('withdrawals').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', req.params.id)
  res.json({ message: 'Rejected and refunded' })
})

// GET /api/admin/me — check if current user is admin
app.get('/api/admin/me', requireAuth, (req, res) => {
  res.json({ isAdmin: ADMIN_USER_IDS.includes(req.user.id) })
})

// ══════════════════════════════════════════════════
//  Export for Vercel
// ══════════════════════════════════════════════════
export default app
