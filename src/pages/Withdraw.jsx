import { useState, useEffect } from 'react'
import { Wallet, ArrowDownLeft, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatUSD, timeAgo } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { balanceApi } from '@/lib/api'
import { authHeaders, loginWithOmegaCases } from '@/lib/auth'

function StatusBadge({ status }) {
  if (status === 'completed') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" /> completed
      </Badge>
    )
  }
  if (status === 'rejected') {
    return (
      <Badge className="bg-red-500/15 text-red-400 border-red-500/30 flex items-center gap-1">
        <XCircle className="h-3 w-3" /> rejected
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 flex items-center gap-1">
      <Clock className="h-3 w-3" /> pending
    </Badge>
  )
}

export default function Withdraw() {
  const { user } = useAuth()
  const [balance, setBalance] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const [paypalAddress, setPaypalAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  async function loadData() {
    if (!user) return
    setFetching(true)
    try {
      const [balRes, wRes] = await Promise.all([
        balanceApi.get(),
        fetch('/api/withdrawals', { headers: authHeaders() }).then(r => r.json()),
      ])
      setBalance(balRes.data.balance)
      setWithdrawals(wRes.withdrawals || [])
    } catch {
      // silently fail
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  if (!user) {
    return (
      <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Sign in to withdraw funds</p>
          <Button onClick={loginWithOmegaCases}>Sign In with OmegaCases</Button>
        </div>
      </div>
    )
  }

  const usdBalance = balance?.usd_balance ?? 0
  const usdAmount = parseFloat(amount) || 0
  const remaining = usdBalance - usdAmount

  async function handleSubmit(e) {
    e.preventDefault()
    if (!paypalAddress.trim() || !paypalAddress.includes('@')) {
      toast({ title: 'Enter a valid PayPal email address', variant: 'destructive' })
      return
    }
    if (usdAmount < 5) {
      toast({ title: 'Minimum withdrawal is $5', variant: 'destructive' })
      return
    }
    if (usdAmount > usdBalance) {
      toast({ title: 'Insufficient balance', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ amount: usdAmount, paypal_address: paypalAddress.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Withdrawal failed', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Withdrawal submitted!', description: 'We will process it within 24 hours.', variant: 'success' })
      setAmount('')
      setPaypalAddress('')
      await loadData()
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' })
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
            <h1 className="font-heading text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <ArrowDownLeft className="h-6 w-6 text-brand-400" />
              Withdraw Funds
            </h1>
            <p className="text-slate-400 text-sm">Withdraw your USD balance to PayPal.</p>
          </div>
          {balance !== null && (
            <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs text-slate-400">Available Balance</p>
                <p className="text-lg font-bold text-white">{formatUSD(usdBalance)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Withdrawal form */}
          <div className="space-y-4">

            {/* Warning */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200/80 leading-relaxed">
                  Withdrawals are processed manually within 24 hours. Funds will be sent to your PayPal email.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 space-y-4">
              <h2 className="font-heading font-semibold text-white">Request Withdrawal</h2>

              <div className="space-y-2">
                <Label htmlFor="paypal">PayPal Email Address</Label>
                <Input
                  id="paypal"
                  type="email"
                  placeholder="your@paypal.com"
                  value={paypalAddress}
                  onChange={e => setPaypalAddress(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="e.g. 50"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="5"
                  max={usdBalance}
                  step="0.01"
                  required
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Minimum: $5.00</span>
                  {amount && (
                    <span className={remaining < 0 ? 'text-red-400' : 'text-slate-400'}>
                      Remaining: {formatUSD(Math.max(0, remaining))}
                    </span>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || usdBalance < 5}
              >
                {loading ? 'Submitting…' : 'Request Withdrawal'}
              </Button>

              {usdBalance < 5 && (
                <p className="text-xs text-slate-500 text-center">
                  You need at least $5.00 to withdraw.
                </p>
              )}
            </form>
          </div>

          {/* Withdrawal history */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="font-heading font-semibold text-white mb-4">Withdrawal History</h2>
            {fetching ? (
              <div className="text-center py-10 text-slate-500 text-sm">Loading…</div>
            ) : withdrawals.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">No withdrawals yet</div>
            ) : (
              <div className="space-y-3">
                {withdrawals.map(w => (
                  <div key={w.id} className="flex items-start justify-between py-3 border-b border-navy-700 last:border-0 gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <ArrowDownLeft className="h-5 w-5 text-brand-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{formatUSD(w.amount)}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[140px]" title={w.paypal_address}>
                          {w.paypal_address}
                        </p>
                        <p className="text-xs text-slate-600">{timeAgo(w.created_at)}</p>
                      </div>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-xl bg-navy-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Withdrawal Info</h3>
              <div className="space-y-1.5 text-xs text-slate-400">
                <p>• Minimum withdrawal: $5.00</p>
                <p>• Processing time: within 24 hours</p>
                <p>• Payments sent via PayPal only</p>
                <p>• Funds are deducted immediately on request</p>
                <p>• Rejected withdrawals are automatically refunded</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
