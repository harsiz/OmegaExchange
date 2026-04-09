import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { offersApi } from '@/lib/api'
import OfferCard from '@/components/OfferCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CryptoIcon } from '@/components/CryptoIcon'
import { CURRENCIES, PAYMENT_METHODS } from '@/lib/utils'
import Footer from '@/components/Footer'

const SORT_OPTIONS = [
  { value: 'price_asc',   label: 'Price: Low → High' },
  { value: 'price_desc',  label: 'Price: High → Low' },
  { value: 'rate_desc',   label: 'Best Completion Rate' },
  { value: 'newest',      label: 'Newest First' },
]

export default function Listings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [offers,    setOffers]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [currency,  setCurrency]  = useState(searchParams.get('currency') || 'BTC')
  const [amount,    setAmount]    = useState(searchParams.get('amount') || '')
  const [payment,   setPayment]   = useState('')
  const [sort,      setSort]      = useState('price_asc')
  const [showFilters, setShowFilters] = useState(false)

  const requestedAmount = parseFloat(amount) || 0

  const fetchOffers = useCallback(async () => {
    setLoading(true)
    try {
      const params = { currency, sort }
      if (payment) params.payment_method = payment
      const { data } = await offersApi.list(params)
      setOffers(data.offers || [])
    } catch {
      setOffers([])
    } finally {
      setLoading(false)
    }
  }, [currency, sort, payment])

  useEffect(() => { fetchOffers() }, [fetchOffers])

  // Sort: sellers who can fulfill first, then others
  const sortedOffers = [...offers].sort((a, b) => {
    const aOk = requestedAmount
      ? a.available_amount >= requestedAmount && a.min_amount <= requestedAmount && a.max_amount >= requestedAmount
      : true
    const bOk = requestedAmount
      ? b.available_amount >= requestedAmount && b.min_amount <= requestedAmount && b.max_amount >= requestedAmount
      : true
    if (aOk && !bOk) return -1
    if (!aOk && bOk) return 1
    return a.price - b.price // lowest price first within each group
  })

  return (
    <div className="page-bg min-h-screen pt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-white mb-1">Buy Crypto</h1>
          <p className="text-slate-400 text-sm">Browse peer-to-peer offers. All trades are escrow-protected.</p>
        </div>

        {/* Currency tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
          {CURRENCIES.map(c => (
            <button
              key={c.symbol}
              onClick={() => setCurrency(c.symbol)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all ${
                currency === c.symbol
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-navy-800 text-slate-400 hover:text-white hover:bg-navy-700'
              }`}
            >
              <CryptoIcon symbol={c.symbol} size={18} />
              {c.symbol}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <Input
              type="number"
              placeholder="Amount you want to spend (USD)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(f => !f)}
            className={showFilters ? 'border-brand-500 text-brand-400' : ''}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" onClick={fetchOffers}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="glass-card rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Payment Method</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPayment('')}
                className={`payment-tag cursor-pointer ${!payment ? 'bg-brand-600/20 text-brand-300 border-brand-500/30' : ''}`}
              >
                All
              </button>
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm}
                  onClick={() => setPayment(pm === payment ? '' : pm)}
                  className={`payment-tag cursor-pointer ${payment === pm ? 'bg-brand-600/20 text-brand-300 border-brand-500/30' : ''}`}
                >
                  {pm}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-slate-400">
            {loading ? 'Loading…' : `${sortedOffers.length} offer${sortedOffers.length !== 1 ? 's' : ''} for ${currency}`}
            {amount && ` · ${amount} USD requested`}
          </p>
          {payment && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => setPayment('')}>
              {payment} ✕
            </Badge>
          )}
        </div>

        {/* Offer list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl border border-navy-800 p-4 h-28 shimmer" />
            ))}
          </div>
        ) : sortedOffers.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-500 mb-2 font-medium">No offers found</p>
            <p className="text-sm text-slate-600">Try a different currency or remove filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Label: can fulfill */}
            {requestedAmount > 0 && sortedOffers.some(o =>
              o.available_amount >= requestedAmount && o.min_amount <= requestedAmount && o.max_amount >= requestedAmount
            ) && (
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wide px-1">
                ✓ Can fulfill your order
              </p>
            )}
            {sortedOffers.map((offer, idx) => {
              const prevOk = idx > 0 && requestedAmount > 0
                ? sortedOffers[idx - 1].available_amount >= requestedAmount
                : false
              const thisOk = requestedAmount > 0
                ? offer.available_amount >= requestedAmount && offer.min_amount <= requestedAmount && offer.max_amount >= requestedAmount
                : true

              return (
                <div key={offer.id}>
                  {requestedAmount > 0 && idx > 0 && !thisOk && prevOk && (
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide px-1 py-2">
                      — Other offers (may not fulfill your full amount)
                    </p>
                  )}
                  <OfferCard offer={offer} requestedAmount={requestedAmount || null} />
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
