import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, PlusCircle, Wallet, TrendingUp, Clock, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import { dashboardApi, offersApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CryptoIcon } from '@/components/CryptoIcon'
import { formatUSD, formatCrypto, getStatusLabel, timeAgo, shortenId } from '@/lib/utils'

const STATUS_ICONS = {
  pending:   <Clock className="h-3.5 w-3.5" />,
  paid:      <ArrowUpRight className="h-3.5 w-3.5" />,
  completed: <CheckCircle className="h-3.5 w-3.5" />,
  disputed:  <AlertTriangle className="h-3.5 w-3.5" />,
}

export default function Dashboard() {
  const { user }   = useAuth()
  const [data,     setData]     = useState(null)
  const [offers,   setOffers]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('trades') // 'trades' | 'offers'

  useEffect(() => {
    Promise.all([dashboardApi.get(), offersApi.list({ seller_id: 'me' })])
      .then(([dashRes, offersRes]) => {
        setData(dashRes.data)
        setOffers(offersRes.data.offers || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!user) return (
    <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Sign in to view your dashboard</p>
        <Link to="/"><Button>Go Home</Button></Link>
      </div>
    </div>
  )

  const stats = data?.stats || {}
  const trades = data?.trades || []

  return (
    <div className="page-bg min-h-screen pt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">Welcome back, {user.username}</h1>
            <p className="text-slate-400 text-sm mt-0.5">Your OmegaExchange dashboard</p>
          </div>
          <div className="flex gap-2">
            <Link to="/deposit">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Wallet className="h-4 w-4" /> Deposit
              </Button>
            </Link>
            <Link to="/create-offer">
              <Button size="sm" className="gap-1.5">
                <PlusCircle className="h-4 w-4" /> New Offer
              </Button>
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'USD Balance',    value: formatUSD(stats.usd_balance ?? 0),    icon: Wallet,       color: 'text-emerald-400' },
            { label: 'Total Trades',   value: stats.total_trades ?? 0,              icon: TrendingUp,   color: 'text-brand-400' },
            { label: 'Completed',      value: stats.completed_trades ?? 0,          icon: CheckCircle,  color: 'text-emerald-400' },
            { label: 'Completion Rate',value: `${stats.completion_rate ?? 100}%`,   icon: TrendingUp,   color: 'text-yellow-400' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className={`text-2xl font-bold font-heading ${s.color}`}>{loading ? '—' : s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-navy-800 rounded-lg p-1 w-fit">
          {[
            { key: 'trades', label: 'My Trades' },
            { key: 'offers', label: 'My Offers' },
            { key: 'deposits', label: 'Deposits' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                tab === t.key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Trades tab */}
        {tab === 'trades' && (
          <div className="space-y-3">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-16 shimmer rounded-xl" />)
            ) : trades.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="mb-3">No trades yet.</p>
                <Link to="/listings"><Button size="sm">Browse Offers</Button></Link>
              </div>
            ) : trades.map(trade => (
              <Link key={trade.id} to={`/trade/${trade.id}`}>
                <div className="glass-card rounded-xl p-4 hover:border-brand-600/30 transition-all cursor-pointer">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CryptoIcon symbol={trade.currency || 'BTC'} size={32} />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {formatCrypto(trade.amount, trade.currency)} {trade.currency}
                        </p>
                        <p className="text-xs text-slate-400">
                          {trade.buyer_id === user.id ? 'Buying from' : 'Selling to'}{' '}
                          <span className="text-slate-300">
                            {trade.buyer_id === user.id ? trade.seller?.username : trade.buyer?.username}
                          </span>
                          {' · '}{timeAgo(trade.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{formatUSD(trade.amount * trade.price)}</p>
                        <p className="text-xs text-slate-400">{formatUSD(trade.price)}/{trade.currency}</p>
                      </div>
                      <Badge variant={trade.status} className="flex items-center gap-1">
                        {STATUS_ICONS[trade.status]}
                        {getStatusLabel(trade.status)}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Offers tab */}
        {tab === 'offers' && (
          <div className="space-y-3">
            {loading ? (
              [1,2].map(i => <div key={i} className="h-20 shimmer rounded-xl" />)
            ) : offers.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="mb-3">You haven't created any offers yet.</p>
                <Link to="/create-offer"><Button size="sm">Create Offer</Button></Link>
              </div>
            ) : offers.map(offer => (
              <div key={offer.id} className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CryptoIcon symbol={offer.currency} size={28} />
                    <div>
                      <p className="text-sm font-semibold text-white">{formatUSD(offer.price)} / {offer.currency}</p>
                      <p className="text-xs text-slate-400">
                        Available: {formatCrypto(offer.available_amount, offer.currency)} {offer.currency}
                        {' · '}Limit: {formatUSD(offer.min_amount)} – {formatUSD(offer.max_amount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={offer.is_active ? 'success' : 'secondary'}>
                      {offer.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                {offer.payment_methods?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {offer.payment_methods.map(pm => (
                      <span key={pm} className="payment-tag">{pm}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Deposits tab */}
        {tab === 'deposits' && (
          <div className="space-y-3">
            {(data?.deposits || []).length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="mb-3">No deposits yet.</p>
                <Link to="/deposit"><Button size="sm">Deposit Funds</Button></Link>
              </div>
            ) : (data?.deposits || []).map(dep => (
              <div key={dep.id} className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{formatUSD(dep.amount)}</p>
                    <p className="text-xs text-slate-400 capitalize">{dep.method} · {timeAgo(dep.created_at)}</p>
                  </div>
                  <Badge variant={dep.status === 'approved' ? 'completed' : dep.status === 'rejected' ? 'disputed' : 'pending'}>
                    {dep.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
