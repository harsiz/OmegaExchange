import { useState, useEffect } from 'react'
import { Wallet, CreditCard, Gift, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { balanceApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { loginWithOmegaCases } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatUSD, timeAgo } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

const METHODS = [
  {
    key:   'paypal',
    label: 'PayPal',
    icon:  CreditCard,
    desc:  'Send USD to our PayPal. Include your username in the note.',
    placeholder: 'PayPal transaction ID (e.g. 1AB23456CD789)',
    color: 'text-blue-400',
    instructions: 'Send your USD amount to paypal@omegaexchange.com — put your OmegaExchange username in the payment note. Then paste your PayPal transaction ID below.',
  },
  {
    key:   'giftcard',
    label: 'Gift Card',
    icon:  Gift,
    desc:  'Submit an Amazon, Google Play, or other gift card.',
    placeholder: 'Gift card code (e.g. XXXX-XXXX-XXXX-XXXX)',
    color: 'text-purple-400',
    instructions: 'Supported: Amazon, Google Play, Xbox, iTunes. Submit the full gift card code below. Denominations accepted: $25, $50, $100, $200.',
  },
]

export default function Deposit() {
  const { user }    = useAuth()
  const [method,    setMethod]    = useState('paypal')
  const [amount,    setAmount]    = useState('')
  const [reference, setReference] = useState('')
  const [balance,   setBalance]   = useState(null)
  const [deposits,  setDeposits]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([balanceApi.get(), balanceApi.deposits()])
      .then(([bRes, dRes]) => {
        setBalance(bRes.data.balance)
        setDeposits(dRes.data.deposits || [])
      })
      .catch(() => {})
  }, [user])

  if (!user) {
    return (
      <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Sign in to deposit funds</p>
          <Button onClick={loginWithOmegaCases}>Sign In with OmegaCases</Button>
        </div>
      </div>
    )
  }

  const selected = METHODS.find(m => m.key === method)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' })
      return
    }
    if (!reference.trim()) {
      toast({ title: 'Enter the transaction reference', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      await balanceApi.deposit({
        method,
        amount:    parseFloat(amount),
        reference: reference.trim(),
      })
      setSubmitted(true)
      toast({ title: 'Deposit submitted!', description: 'We\'ll review and approve within 30 minutes.', variant: 'success' })
      setAmount('')
      setReference('')
    } catch (err) {
      toast({ title: 'Failed to submit', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-bg min-h-screen pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white mb-1">Deposit Funds</h1>
            <p className="text-slate-400 text-sm">Add USD to your OmegaExchange balance to buy crypto.</p>
          </div>
          {balance !== null && (
            <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs text-slate-400">Current Balance</p>
                <p className="text-lg font-bold text-white">{formatUSD(balance.usd_balance)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Deposit form */}
          <div className="space-y-4">

            {/* Method selection */}
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-heading font-semibold text-white mb-4">Payment Method</h2>
              <div className="grid grid-cols-2 gap-3">
                {METHODS.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(m.key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      method === m.key
                        ? 'border-brand-500 bg-brand-600/10'
                        : 'border-navy-700 bg-navy-800/50 hover:border-navy-600'
                    }`}
                  >
                    <m.icon className={`h-6 w-6 ${method === m.key ? 'text-brand-400' : m.color}`} />
                    <span className="text-sm font-semibold text-white">{m.label}</span>
                    <span className="text-[11px] text-slate-400 text-center leading-tight">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-200/80 leading-relaxed">{selected?.instructions}</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 space-y-4">
              <h2 className="font-heading font-semibold text-white">Submit Deposit</h2>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="e.g. 100"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="5"
                  step="0.01"
                  required
                />
                <p className="text-xs text-slate-500">Minimum: $5.00</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ref">{selected?.label} Reference</Label>
                <Input
                  id="ref"
                  type="text"
                  placeholder={selected?.placeholder}
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Deposit Request'}
              </Button>

              {submitted && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Submitted! Pending review.
                </div>
              )}
            </form>
          </div>

          {/* Deposit history */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-heading font-semibold text-white mb-4">Deposit History</h2>
            {deposits.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">No deposits yet</div>
            ) : (
              <div className="space-y-3">
                {deposits.map(dep => (
                  <div key={dep.id} className="flex items-center justify-between py-3 border-b border-navy-700 last:border-0">
                    <div className="flex items-center gap-3">
                      {dep.method === 'paypal' ? (
                        <CreditCard className="h-5 w-5 text-blue-400" />
                      ) : (
                        <Gift className="h-5 w-5 text-purple-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">{formatUSD(dep.amount)}</p>
                        <p className="text-xs text-slate-500 capitalize">{dep.method} · {timeAgo(dep.created_at)}</p>
                      </div>
                    </div>
                    <Badge variant={
                      dep.status === 'approved' ? 'completed' :
                      dep.status === 'rejected' ? 'disputed'  : 'pending'
                    }>
                      {dep.status === 'pending' && <Clock className="h-3 w-3" />}
                      {dep.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                      {dep.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Info box */}
            <div className="mt-4 rounded-xl bg-navy-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Review Times</h3>
              <div className="space-y-1.5 text-xs text-slate-400">
                <p>• PayPal deposits: typically under 30 minutes</p>
                <p>• Gift card codes: 15–60 minutes</p>
                <p>• Deposits are reviewed manually for security</p>
                <p>• Your USD balance updates immediately on approval</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
