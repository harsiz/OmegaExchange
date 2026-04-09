import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Info, CheckCircle, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react'
import { offersApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { loginWithOmegaCases } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CryptoIcon } from '@/components/CryptoIcon'
import { CURRENCIES, PAYMENT_METHODS } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

// CoinGecko coin IDs mapped to our symbols
const COINGECKO_IDS = {
  BTC:  'bitcoin',
  ETH:  'ethereum',
  SOL:  'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  LTC:  'litecoin',
  BCH:  'bitcoin-cash',
}

async function fetchMarketPrice(symbol) {
  const id = COINGECKO_IDS[symbol]
  if (!id) return null
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const data = await res.json()
  return data[id]?.usd ?? null
}

export default function CreateOffer() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm] = useState({
    currency:             'BTC',
    price:                '',
    min_amount:           '',
    max_amount:           '',
    available_amount:     '',
    payment_methods:      [],
    payment_instructions: '',
  })
  const [loading,      setLoading]      = useState(false)
  const [success,      setSuccess]      = useState(false)
  const [marketPrice,  setMarketPrice]  = useState(null)   // current market price
  const [priceLoading, setPriceLoading] = useState(false)
  const [offMarket,    setOffMarket]    = useState(false)   // user deviated from market price

  // Track if user manually changed price
  const userEditedPrice = useRef(false)

  // Fetch market price whenever currency changes
  useEffect(() => {
    let cancelled = false
    setPriceLoading(true)
    setMarketPrice(null)
    userEditedPrice.current = false
    setOffMarket(false)

    fetchMarketPrice(form.currency).then(price => {
      if (cancelled) return
      setPriceLoading(false)
      if (price) {
        setMarketPrice(price)
        // Only auto-fill if user hasn't manually typed a price
        if (!userEditedPrice.current) {
          setForm(f => ({ ...f, price: String(price) }))
        }
      }
    }).catch(() => { if (!cancelled) setPriceLoading(false) })

    return () => { cancelled = true }
  }, [form.currency])

  function handlePriceChange(e) {
    const val = e.target.value
    userEditedPrice.current = true
    setForm(f => ({ ...f, price: val }))

    // Warn if more than 2% off market price
    if (marketPrice && val) {
      const pct = Math.abs((parseFloat(val) - marketPrice) / marketPrice)
      setOffMarket(pct > 0.02)
    } else {
      setOffMarket(false)
    }
  }

  function applyMarketPrice() {
    if (!marketPrice) return
    userEditedPrice.current = false
    setForm(f => ({ ...f, price: String(marketPrice) }))
    setOffMarket(false)
  }

  if (!user) {
    return (
      <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Sign in to create sell offers</p>
          <Button onClick={loginWithOmegaCases}>Sign In with OmegaCases</Button>
        </div>
      </div>
    )
  }

  function togglePayment(pm) {
    setForm(f => ({
      ...f,
      payment_methods: f.payment_methods.includes(pm)
        ? f.payment_methods.filter(p => p !== pm)
        : [...f.payment_methods, pm],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.payment_methods.length === 0) {
      toast({ title: 'Select at least one payment method', variant: 'destructive' })
      return
    }
    if (parseFloat(form.min_amount) > parseFloat(form.max_amount)) {
      toast({ title: 'Min amount cannot exceed max amount', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      await offersApi.create({
        currency:             form.currency,
        price:                parseFloat(form.price),
        min_amount:           parseFloat(form.min_amount),
        max_amount:           parseFloat(form.max_amount),
        available_amount:     parseFloat(form.available_amount),
        payment_methods:      form.payment_methods,
        payment_instructions: form.payment_instructions,
      })
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      toast({
        title:       'Failed to create offer',
        description: err.response?.data?.error || 'Please try again.',
        variant:     'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="font-heading text-xl font-bold text-white mb-2">Offer Created!</h2>
          <p className="text-slate-400">Redirecting to dashboard…</p>
        </div>
      </div>
    )
  }

  const priceDiffPct = marketPrice && form.price
    ? (((parseFloat(form.price) - marketPrice) / marketPrice) * 100).toFixed(1)
    : null

  return (
    <div className="page-bg min-h-screen pt-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-white mb-1">Create Sell Offer</h1>
          <p className="text-slate-400 text-sm">List your crypto for buyers to purchase. Trades are escrow-protected.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Currency & Pricing */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <h2 className="font-heading font-semibold text-white">Asset & Pricing</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Currency selector */}
              <div className="space-y-2">
                <Label>Cryptocurrency</Label>
                <Select
                  value={form.currency}
                  onValueChange={v => {
                    userEditedPrice.current = false
                    setForm(f => ({ ...f, currency: v, price: '' }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <CryptoIcon symbol={form.currency} size={18} />
                        {form.currency}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.symbol} value={c.symbol}>
                        <div className="flex items-center gap-2">
                          <CryptoIcon symbol={c.symbol} size={18} />
                          {c.symbol} — {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="price">Your Price (USD per {form.currency})</Label>
                  {marketPrice && (
                    <button
                      type="button"
                      onClick={applyMarketPrice}
                      className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      <TrendingUp className="h-3 w-3" />
                      Market: ${marketPrice.toLocaleString()}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Input
                    id="price"
                    type="number"
                    placeholder={priceLoading ? 'Fetching price…' : 'e.g. 83000'}
                    value={form.price}
                    onChange={handlePriceChange}
                    required
                    min="0"
                    step="0.01"
                    className={offMarket ? 'border-amber-500/60 focus-visible:ring-amber-500' : ''}
                  />
                  {priceLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 animate-spin" />
                  )}
                </div>

                {/* Market price badge */}
                {marketPrice && !priceLoading && form.price && !offMarket && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    At market price
                    {priceDiffPct !== null && priceDiffPct !== '0.0' && (
                      <span>({priceDiffPct > 0 ? '+' : ''}{priceDiffPct}%)</span>
                    )}
                  </p>
                )}

                {/* Off-market warning */}
                {offMarket && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs text-amber-300 font-medium">
                        Not at market price
                        {priceDiffPct && (
                          <span className="ml-1 font-normal text-amber-400/80">
                            ({priceDiffPct > 0 ? '+' : ''}{priceDiffPct}% vs ${marketPrice.toLocaleString()})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-amber-400/70">
                        You'll be less likely to sell. <button type="button" onClick={applyMarketPrice} className="underline hover:text-amber-300">Use market price?</button>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="available">Available ({form.currency})</Label>
                <Input
                  id="available"
                  type="number"
                  placeholder="0.5"
                  value={form.available_amount}
                  onChange={e => setForm(f => ({ ...f, available_amount: e.target.value }))}
                  required min="0" step="any"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min">Min Order (USD)</Label>
                <Input
                  id="min"
                  type="number"
                  placeholder="50"
                  value={form.min_amount}
                  onChange={e => setForm(f => ({ ...f, min_amount: e.target.value }))}
                  required min="1" step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max">Max Order (USD)</Label>
                <Input
                  id="max"
                  type="number"
                  placeholder="5000"
                  value={form.max_amount}
                  onChange={e => setForm(f => ({ ...f, max_amount: e.target.value }))}
                  required min="1" step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Payment methods */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <h2 className="font-heading font-semibold text-white">Payment Methods</h2>
            <p className="text-sm text-slate-400">Select the payment methods you accept from buyers.</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(pm => {
                const selected = form.payment_methods.includes(pm)
                return (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => togglePayment(pm)}
                    className={`payment-tag cursor-pointer transition-all ${
                      selected ? 'bg-brand-600/20 text-brand-300 border-brand-500/40' : ''
                    }`}
                  >
                    {selected && '✓ '}{pm}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Payment instructions */}
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-2">
              <h2 className="font-heading font-semibold text-white">Payment Instructions</h2>
              <Info className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
            </div>
            <p className="text-sm text-slate-400">
              Shown to buyers after they start a trade. Include your payment details (e.g. PayPal email, Cashapp tag).
            </p>
            <textarea
              value={form.payment_instructions}
              onChange={e => setForm(f => ({ ...f, payment_instructions: e.target.value }))}
              placeholder="e.g. Send payment to myemail@paypal.com — include your username in the note."
              rows={4}
              className="w-full rounded-lg border border-navy-600 bg-navy-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
            <PlusCircle className="h-5 w-5" />
            {loading ? 'Creating Offer…' : 'Create Sell Offer'}
          </Button>
        </form>
      </div>
    </div>
  )
}
