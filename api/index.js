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
  OMEGACASES_OAUTH_URL    = 'https://omegacases.com/oauth/authorize',
  OMEGACASES_TOKEN_URL    = 'https://omegacases.com/oauth/token',
  OMEGACASES_USER_URL     = 'https://omegacases.com/api/oauth/me',
} = process.env

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

// ══════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════

// GET /api/auth/login — redirect to OmegaCases OAuth
app.get('/api/auth/login', (req, res) => {
  const params = new URLSearchParams({
    client_id:     OMEGACASES_CLIENT_ID || 'YOUR_CLIENT_ID',
    redirect_uri:  `${APP_URL}/api/auth/callback`,
    response_type: 'code',
    scope:         'user:read',
  })
  res.redirect(`${OMEGACASES_OAUTH_URL}?${params}`)
})

// GET /api/auth/callback — exchange code (or token) for user info, issue JWT
app.get('/api/auth/callback', async (req, res) => {
  const { code, token: directToken, error } = req.query
  if (error) return res.redirect(`${APP_URL}/auth/callback?error=${error}`)
  if (!code && !directToken) return res.redirect(`${APP_URL}/auth/callback?error=no_code`)

  try {
    let accessToken

    if (directToken) {
      // OmegaCases passed the token directly in the redirect
      accessToken = directToken
    } else {
      // Standard authorization code exchange
      const tokenRes = await fetch(OMEGACASES_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     OMEGACASES_CLIENT_ID,
          client_secret: OMEGACASES_CLIENT_SECRET,
          code,
          redirect_uri:  `${APP_URL}/api/auth/callback`,
          grant_type:    'authorization_code',
        }),
      })
      const tokenData = await tokenRes.json()
      if (!tokenData.access_token) throw new Error('No access token from OmegaCases')
      accessToken = tokenData.access_token
    }

    // Fetch user info — OmegaCases uses ?token= query param
    const userRes  = await fetch(`${OMEGACASES_USER_URL}?token=${accessToken}`)
    const rawBody = await userRes.text()
    console.log('[auth/callback] user info status:', userRes.status, 'body:', rawBody.slice(0, 300))

    let userData
    try {
      userData = JSON.parse(rawBody)
    } catch {
      throw new Error(`User info endpoint returned non-JSON (status ${userRes.status}): ${rawBody.slice(0, 200)}`)
    }

    const userId   = String(userData.id || userData.userid || userData.user_id || '')
    const username = userData.username || userData.name

    if (!userId || !username) throw new Error(`Missing user data: ${JSON.stringify(userData)}`)

    // Upsert user in DB
    const { error: upsertErr } = await supabase
      .from('users')
      .upsert({ id: userId, username }, { onConflict: 'id', ignoreDuplicates: false })
    if (upsertErr) console.error('Upsert error:', upsertErr)

    // Ensure balance row exists
    await supabase.from('balances').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    await supabase.from('reputation').upsert(
      { user_id: userId, total_trades: 0, successful_trades: 0, rating: 5.0 },
      { onConflict: 'user_id', ignoreDuplicates: true },
    )

    // Issue JWT
    const token = jwt.sign(
      { sub: userId, username },
      JWT_SECRET,
      { expiresIn: '30d' },
    )

    res.redirect(`${APP_URL}/auth/callback?token=${token}`)
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
  const { currency, payment_method, sort = 'price_asc', seller_id } = req.query

  let query = supabase
    .from('offers')
    .select(`
      *,
      seller:users!offers_seller_id_fkey(id, username),
      reputation:reputation!reputation_user_id_fkey(total_trades, successful_trades, rating)
    `)
    .eq('is_active', true)
    .gt('available_amount', 0)

  if (currency)       query = query.eq('currency', currency)
  if (payment_method) query = query.contains('payment_methods', [payment_method])
  if (seller_id === 'me') {
    // handled with requireAuth — for now return empty if no auth header
  }

  // Sort
  if (sort === 'price_asc')  query = query.order('price', { ascending: true })
  if (sort === 'price_desc') query = query.order('price', { ascending: false })
  if (sort === 'newest')     query = query.order('created_at', { ascending: false })

  const { data, error } = await query.limit(50)
  if (error) return res.status(500).json({ error: error.message })

  // Sort by reputation if requested
  let offers = data || []
  if (sort === 'rate_desc') {
    offers = offers.sort((a, b) => {
      const rateA = a.reputation?.total_trades ? a.reputation.successful_trades / a.reputation.total_trades : 1
      const rateB = b.reputation?.total_trades ? b.reputation.successful_trades / b.reputation.total_trades : 1
      return rateB - rateA
    })
  }

  res.json({ offers })
})

// GET /api/offers/:id
app.get('/api/offers/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('offers')
    .select('*, seller:users!offers_seller_id_fkey(id, username), reputation(*)')
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

// ══════════════════════════════════════════════════
//  Export for Vercel
// ══════════════════════════════════════════════════
export default app
