import { useState, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatUSD, timeAgo } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { authHeaders } from '@/lib/auth'

function DepositStatusBadge({ status }) {
  if (status === 'approved') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" /> approved
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

function WithdrawalStatusBadge({ status }) {
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

export default function Admin() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(null)
  const [tab, setTab] = useState('deposits')
  const [deposits, setDeposits] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState({})

  useEffect(() => {
    if (!user) return
    fetch('/api/admin/me', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setIsAdmin(data.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [user])

  async function loadAll() {
    setLoading(true)
    try {
      const [dRes, wRes] = await Promise.all([
        fetch('/api/admin/deposits', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/withdrawals', { headers: authHeaders() }).then(r => r.json()),
      ])
      setDeposits(dRes.deposits || [])
      setWithdrawals(wRes.withdrawals || [])
    } catch {
      toast({ title: 'Failed to load data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) loadAll()
  }, [isAdmin])

  async function adminAction(url, id, successMsg) {
    setActionLoading(prev => ({ ...prev, [id]: true }))
    try {
      const res = await fetch(url, { method: 'POST', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Action failed', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: successMsg, variant: 'success' })
      await loadAll()
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  if (!user) {
    return (
      <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
        <p className="text-slate-400">Sign in to access this page.</p>
      </div>
    )
  }

  if (isAdmin === null) {
    return (
      <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
        <p className="text-slate-400">Checking access…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center glass-card rounded-2xl p-10 max-w-sm">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="font-heading text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 text-sm">You do not have permission to view this page.</p>
        </div>
      </div>
    )
  }

  const pendingDeposits = deposits.filter(d => d.status === 'pending').length
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length

  return (
    <div className="page-bg min-h-screen pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-400" />
              Admin Panel
            </h1>
            <p className="text-slate-400 text-sm">Manage deposits and withdrawals.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAll}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{deposits.length}</p>
            <p className="text-xs text-slate-400 mt-1">Total Deposits</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{pendingDeposits}</p>
            <p className="text-xs text-slate-400 mt-1">Pending Deposits</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{withdrawals.length}</p>
            <p className="text-xs text-slate-400 mt-1">Total Withdrawals</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{pendingWithdrawals}</p>
            <p className="text-xs text-slate-400 mt-1">Pending Withdrawals</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab('deposits')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'deposits'
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Deposits
            {pendingDeposits > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingDeposits}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('withdrawals')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'withdrawals'
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Withdrawals
            {pendingWithdrawals > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingWithdrawals}
              </span>
            )}
          </button>
        </div>

        {/* Deposits Tab */}
        {tab === 'deposits' && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-navy-700">
              <h2 className="font-heading font-semibold text-white">Deposit Requests</h2>
            </div>
            {deposits.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No deposits found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-700">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">User</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Method</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Amount</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Reference / TX ID</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map(dep => (
                      <tr key={dep.id} className="border-b border-navy-700/50 hover:bg-white/2 transition-colors">
                        <td className="px-5 py-3 text-white font-medium">
                          {dep.user?.username || dep.user_id}
                        </td>
                        <td className="px-5 py-3 text-slate-300 capitalize">{dep.method}</td>
                        <td className="px-5 py-3 text-emerald-400 font-semibold">{formatUSD(dep.amount)}</td>
                        <td className="px-5 py-3 text-slate-400 font-mono text-xs max-w-[180px] truncate" title={dep.reference}>
                          {dep.reference}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{timeAgo(dep.created_at)}</td>
                        <td className="px-5 py-3">
                          <DepositStatusBadge status={dep.status} />
                        </td>
                        <td className="px-5 py-3">
                          {dep.status === 'pending' ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                                disabled={!!actionLoading[dep.id]}
                                onClick={() => adminAction(`/api/admin/deposits/${dep.id}/approve`, dep.id, 'Deposit approved!')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-500/50 text-red-400 hover:bg-red-950 hover:text-red-300 text-xs h-7 px-3"
                                disabled={!!actionLoading[dep.id]}
                                onClick={() => adminAction(`/api/admin/deposits/${dep.id}/reject`, dep.id, 'Deposit rejected.')}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Withdrawals Tab */}
        {tab === 'withdrawals' && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-navy-700">
              <h2 className="font-heading font-semibold text-white">Withdrawal Requests</h2>
            </div>
            {withdrawals.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No withdrawals found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-700">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">User</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Amount</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">PayPal Address</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map(w => (
                      <tr key={w.id} className="border-b border-navy-700/50 hover:bg-white/2 transition-colors">
                        <td className="px-5 py-3 text-white font-medium">
                          {w.user?.username || w.user_id}
                        </td>
                        <td className="px-5 py-3 text-brand-400 font-semibold">{formatUSD(w.amount)}</td>
                        <td className="px-5 py-3 text-slate-300 text-xs max-w-[180px] truncate" title={w.paypal_address}>
                          {w.paypal_address}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{timeAgo(w.created_at)}</td>
                        <td className="px-5 py-3">
                          <WithdrawalStatusBadge status={w.status} />
                        </td>
                        <td className="px-5 py-3">
                          {w.status === 'pending' ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                                disabled={!!actionLoading[w.id]}
                                onClick={() => adminAction(`/api/admin/withdrawals/${w.id}/complete`, w.id, 'Withdrawal marked as paid!')}
                              >
                                Mark Paid
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-500/50 text-red-400 hover:bg-red-950 hover:text-red-300 text-xs h-7 px-3"
                                disabled={!!actionLoading[w.id]}
                                onClick={() => adminAction(`/api/admin/withdrawals/${w.id}/reject`, w.id, 'Withdrawal rejected & refunded.')}
                              >
                                Reject & Refund
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
