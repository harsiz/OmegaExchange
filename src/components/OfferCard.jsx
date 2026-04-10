import { useNavigate } from 'react-router-dom'
import { Star, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CryptoIcon } from '@/components/CryptoIcon'
import { formatUSD, formatCrypto, getCompletionRate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { loginWithOmegaCases } from '@/lib/auth'
import { tradesApi } from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useState } from 'react'

export default function OfferCard({ offer, requestedAmount }) {
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const [loading, setLoading] = useState(false)

  const rate        = getCompletionRate(offer.reputation)
  // requestedAmount is in USD; available_amount is in crypto — convert to USD for comparison
  const availableUSD = (offer.available_amount || 0) * (offer.price || 1)
  const canFulfill   = requestedAmount
    ? availableUSD >= requestedAmount && offer.min_amount <= requestedAmount && offer.max_amount >= requestedAmount
    : true

  async function handleBuy() {
    if (!user) { loginWithOmegaCases(); return }
    if (user.id === offer.seller_id) { toast({ title: 'Cannot buy your own offer', variant: 'destructive' }); return }

    setLoading(true)
    try {
      const amount = requestedAmount || offer.min_amount
      const { data } = await tradesApi.create({ offer_id: offer.id, amount })
      const tradeId = data?.trade?.id
      if (!tradeId) throw new Error('Trade created but no ID returned — check My Trades.')
      navigate(`/trade/${tradeId}`)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Please try again.'
      toast({ title: 'Failed to start trade', description: msg, variant: 'destructive' })
      setLoading(false) // only reset on error — on success the component unmounts via navigate
    }
  }

  return (
    <div className={`offer-card rounded-xl border p-4 transition-all ${
      canFulfill
        ? 'border-navy-700 bg-navy-800/50 hover:bg-navy-800'
        : 'border-navy-800 bg-navy-900/30 opacity-70'
    }`}>
      <div className="flex items-start justify-between gap-4">

        {/* Seller info */}
        <div className="flex items-start gap-3 min-w-0">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarFallback>{offer.seller?.username?.slice(0, 2).toUpperCase() ?? '??'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">{offer.seller?.username ?? 'Unknown'}</span>
              {offer.reputation?.total_trades > 10 && (
                <Badge variant="success" className="text-[10px] px-1.5 py-0">
                  <CheckCircle className="h-3 w-3" /> Verified
                </Badge>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                {offer.reputation?.rating?.toFixed(1) ?? '5.0'}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {rate}% completion
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {offer.reputation?.total_trades ?? 0} trades
              </span>
            </div>

            {/* Payment methods */}
            <div className="flex flex-wrap gap-1 mt-2">
              {(offer.payment_methods || []).slice(0, 4).map(pm => (
                <span key={pm} className="payment-tag">{pm}</span>
              ))}
              {(offer.payment_methods || []).length > 4 && (
                <span className="payment-tag">+{offer.payment_methods.length - 4}</span>
              )}
            </div>
          </div>
        </div>

        {/* Price + action */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <CryptoIcon symbol={offer.currency} size={16} />
              <span className="text-lg font-bold text-white">{formatUSD(offer.price)}</span>
            </div>
            <p className="text-xs text-slate-400">per {offer.currency}</p>
          </div>

          <div className="text-right text-xs text-slate-400">
            <p>Available: <span className="text-slate-300 font-medium">{formatCrypto(offer.available_amount, offer.currency)} {offer.currency}</span></p>
            <p>Limit: <span className="text-slate-300">{formatUSD(offer.min_amount)} – {formatUSD(offer.max_amount)}</span></p>
          </div>

          <Button
            onClick={handleBuy}
            disabled={!canFulfill || loading}
            size="sm"
            className="w-full min-w-[80px]"
          >
            {loading ? 'Starting…' : canFulfill ? 'Buy' : 'Insufficient'}
          </Button>
        </div>
      </div>
    </div>
  )
}
