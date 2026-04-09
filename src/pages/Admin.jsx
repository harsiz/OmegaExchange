import { useState, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, Clock, RefreshCw, Search, Wallet, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatUSD, timeAgo } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { authHeaders } from '@/lib/auth'

const TABS = ['deposits', 'withdrawals', 'disputes', 'balances']

function StatusBadge({ status, map }) {
  const cfg = map[status] || { color: 'amber', label: status }
  const colors = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    red:     'bg-red-500/15 text-red-400 border-red-500/30',
    amber:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
    blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }
  const icons = { emerald: <CheckCircle className="h-3 w-3" />, red: <XCircle className="h-3 w-3" />, amber: <Clock className="h-3 w-3" />, blue: <AlertTriangle className="h-3 w-3" /> }
  return (
    <Badge className={`${colors[cfg.color]} flex items-center gap-1`}>
      {icons[cfg.color]} {cfg.label}
    </Badge>
  )
}

const DEPOSIT_STATUS = {
  pending:  { color: 'amber',   label: 'pending'  },
  approved: { color: 'emerald', label: 'approved' },
  rejected: { color: 'red',     label: 'rejected' },
}
const WITHDRAWAL_STATUS = {
  pending:   { color: 'amber',   label: 'pending'   },
  completed: { color: 'emerald', label: 'completed' },
  rejected:  { color: 'red',     label: 'rejected'  },
}
const DISPUTE_STATUS = {
  open:     { color: 'blue',    label: 'open'     },
  resolved: { color: 'emerald', label: 'resolved' },
  closed:   { color: 'red',     label: 'closed'   },
}

export default function Admin() {
  const { user } = useAuth()
  const [isAdmin,      setIsAdmin]      = useState(null)
  const [tab,          setTab]          = useState('deposits')
  const [deposits,     setDeposits]     = useState([])
  const [withdrawals,  setWithdrawals]  = useState([])
  const [disputes,     setDisputes]     = useState([])
  const [loading,      setLoading]      = useState(false)
  const [actionLoading,setActionLoading]= useState({})

  // Balance tool state
  const [balSearch,    setBalSearch]    = useState('')
  const [balUsers,     setBalUsers]     = useState([])
  const [balSearching, setBalSearching] = useState(false)
  const [setBalUser,   setSetBalUser]   = useState('')
  const [setBalAmt,    setSetBalAmt]    = useState('')
  const [settingBal,   setSettingBal]   = useState(false)

  useEffect(() => {
    if (!user) return
    fetch('/api/admin/me', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [user])

  async function loadAll() {
    setLoading(true)
    try {
      const [dRes, wRes, dispRes] = await Promise.all([
        fetch('/api/admin/deposits',   { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/withdrawals',{ headers: authHeaders() }).then(r => r.json()),
        fetch('/api/admin/disputes',   { headers: authHeaders() }).then(r => r.json()),
      ])
      setDeposits(dRes.deposits     || [])
      setWithdrawals(wRes.withdrawals || [])
      setDisputes(dispRes.disputes   || [])
    } catch {
      toast({ title: 'Failed to load', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isAdmin) loadAll() }, [isAdmin])

  async function adminAction(url, id, successMsg) {
    setActionLoading(p => ({ ...p, [id]: true }))
    try {
      const res  = await fetch(url, { method: 'POST', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) { toast({ title: 'Action failed', description: data.error, variant: 'destructive' }); return }
      toast({ title: successMsg, variant: 'success' })
      await loadAll()
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setActionLoading(p => ({ ...p, [id]: false }))
    }
  }

  async function searchBalances() {
    setBalSearching(true)
    try {
      const res  = await fetch(`/api/admin/users?username=${encodeURIComponent(balSearch)}`, { headers: authHeaders() })
      const data = await res.json()
      setBalUsers(data.users || [])
    } catch {
      toast({ title: 'Search failed', variant: 'destructive' })
    } finally {
      setBalSearching(false)
    }
  }

  async function setBalance(e) {
    e.preventDefault()
    if (!setBalUser || !setBalAmt) return
    setSettingBal(true)
    try {
      const res  = await fetch('/api/admin/balances/set', {
        method:  'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: setBalUser, amount: parseFloat(setBalAmt) }),
      })
      const data = await res.json()
      if (!res.ok) { toast({ title: 'Failed', description: data.error, variant: 'destructive' }); return }
      toast({ title: data.message, variant: 'success' })
      setSetBalUser('')
      setSetBalAmt('')
      if (balUsers.length) searchBalances()
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setSettingBal(false)
    }
  }

  if (!user) return <div className="page-bg min-h-screen pt-20 flex items-center justify-center"><p className="text-slate-400">Sign in first.</p></div>
  if (isAdmin === null) return <div className="page-bg min-h-screen pt-20 flex items-center justify-center"><p className="text-slate-400">Checking access…</p></div>
  if (!isAdmin) return (
    <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
      <div className="text-center glass-card rounded-2xl p-10 max-w-sm">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h1 className="font-heading text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 text-sm">Admin only.</p>
      </div>
    </div>
  )

  const pendingDep  = deposits.filter(d => d.status === 'pending').length
  const pendingWith = withdrawals.filter(w => w.status === 'pending').length
  const openDisp    = disputes.filter(d => d.status === 'open').length

  const tabLabel = (key, label, badge) => (
    <button
      onClick={() => setTab(key)}
      className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
      {label}
      {badge > 0 && <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{badge}</span>}
    </button>
  )

  return (
    <div className="page-bg min-h-screen pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-400" /> Admin Panel
            </h1>
            <p className="text-slate-400 text-sm">Manage deposits, withdrawals, disputes and balances.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Pending Deposits',    value: pendingDep,  color: 'text-amber-400'   },
            { label: 'Pending Withdrawals', value: pendingWith, color: 'text-brand-400'   },
            { label: 'Open Disputes',       value: openDisp,    color: 'text-red-400'     },
            { label: 'Total Deposits',      value: deposits.length, color: 'text-white'   },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {tabLabel('deposits',    'Deposits',    pendingDep)}
          {tabLabel('withdrawals', 'Withdrawals', pendingWith)}
          {tabLabel('disputes',    'Disputes',    openDisp)}
          {tabLabel('balances',    'Balances',    0)}
        </div>

        {/* ── Deposits ── */}
        {tab === 'deposits' && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-navy-700"><h2 className="font-heading font-semibold text-white">Deposit Requests</h2></div>
            {deposits.length === 0 ? <div className="text-center py-12 text-slate-500 text-sm">No deposits found</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-navy-700">
                    {['User','Method','Amount','Reference / TX ID','Date','Status','Actions'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {deposits.map(dep => (
                      <tr key={dep.id} className="border-b border-navy-700/50 hover:bg-white/[0.02]">
                        <td className="px-5 py-3 text-white font-medium">{dep.user?.username || dep.user_id}</td>
                        <td className="px-5 py-3 text-slate-300 capitalize">{dep.method}</td>
                        <td className="px-5 py-3 text-emerald-400 font-semibold">{formatUSD(dep.amount)}</td>
                        <td className="px-5 py-3 text-slate-400 font-mono text-xs max-w-[160px] truncate" title={dep.reference}>{dep.reference}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{timeAgo(dep.created_at)}</td>
                        <td className="px-5 py-3"><StatusBadge status={dep.status} map={DEPOSIT_STATUS} /></td>
                        <td className="px-5 py-3">
                          {dep.status === 'pending' ? (
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3" disabled={!!actionLoading[dep.id]}
                                onClick={() => adminAction(`/api/admin/deposits/${dep.id}/approve`, dep.id, 'Approved!')}>Approve</Button>
                              <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-950 text-xs h-7 px-3" disabled={!!actionLoading[dep.id]}
                                onClick={() => adminAction(`/api/admin/deposits/${dep.id}/reject`, dep.id, 'Rejected.')}>Reject</Button>
                            </div>
                          ) : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Withdrawals ── */}
        {tab === 'withdrawals' && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-navy-700"><h2 className="font-heading font-semibold text-white">Withdrawal Requests</h2></div>
            {withdrawals.length === 0 ? <div className="text-center py-12 text-slate-500 text-sm">No withdrawals found</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-navy-700">
                    {['User','Amount','PayPal Address','Date','Status','Actions'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {withdrawals.map(w => (
                      <tr key={w.id} className="border-b border-navy-700/50 hover:bg-white/[0.02]">
                        <td className="px-5 py-3 text-white font-medium">{w.user?.username || w.user_id}</td>
                        <td className="px-5 py-3 text-brand-400 font-semibold">{formatUSD(w.amount)}</td>
                        <td className="px-5 py-3 text-slate-300 text-xs max-w-[180px] truncate" title={w.paypal_address}>{w.paypal_address}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{timeAgo(w.created_at)}</td>
                        <td className="px-5 py-3"><StatusBadge status={w.status} map={WITHDRAWAL_STATUS} /></td>
                        <td className="px-5 py-3">
                          {w.status === 'pending' ? (
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3" disabled={!!actionLoading[w.id]}
                                onClick={() => adminAction(`/api/admin/withdrawals/${w.id}/complete`, w.id, 'Marked paid!')}>Mark Paid</Button>
                              <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-950 text-xs h-7 px-3" disabled={!!actionLoading[w.id]}
                                onClick={() => adminAction(`/api/admin/withdrawals/${w.id}/reject`, w.id, 'Rejected & refunded.')}>Reject & Refund</Button>
                            </div>
                          ) : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Disputes ── */}
        {tab === 'disputes' && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-navy-700"><h2 className="font-heading font-semibold text-white">Disputes</h2></div>
            {disputes.length === 0 ? <div className="text-center py-12 text-slate-500 text-sm">No disputes found</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-navy-700">
                    {['Opened By','Trade ID','Currency','Amount','Reason','Date','Status'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {disputes.map(d => (
                      <tr key={d.id} className="border-b border-navy-700/50 hover:bg-white/[0.02]">
                        <td className="px-5 py-3 text-white font-medium">{d.opener?.username || d.opened_by}</td>
                        <td className="px-5 py-3 text-slate-400 font-mono text-xs">{d.trade_id?.slice(0,8)}…</td>
                        <td className="px-5 py-3 text-slate-300">{d.trade?.currency || '—'}</td>
                        <td className="px-5 py-3 text-brand-400 font-semibold">
                          {d.trade ? formatUSD(d.trade.usd_amount ?? d.trade.amount * d.trade.price) : '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-400 max-w-[220px] truncate text-xs" title={d.reason}>{d.reason}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{timeAgo(d.created_at)}</td>
                        <td className="px-5 py-3"><StatusBadge status={d.status} map={DISPUTE_STATUS} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Balances ── */}
        {tab === 'balances' && (
          <div className="space-y-5">

            {/* Set balance form */}
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-heading font-semibold text-white mb-4 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-brand-400" /> Set User Balance
              </h2>
              <form onSubmit={setBalance} className="flex gap-3 flex-wrap">
                <Input
                  placeholder="Username"
                  value={setBalUser}
                  onChange={e => setSetBalUser(e.target.value)}
                  className="w-48"
                  required
                />
                <Input
                  type="number"
                  placeholder="New balance (USD)"
                  value={setBalAmt}
                  onChange={e => setSetBalAmt(e.target.value)}
                  className="w-48"
                  min="0"
                  step="0.01"
                  required
                />
                <Button type="submit" disabled={settingBal} className="gap-1.5">
                  {settingBal ? 'Setting…' : 'Set Balance'}
                </Button>
              </form>
              <p className="text-xs text-slate-500 mt-2">This overwrites the user's current balance. Use carefully.</p>
            </div>

            {/* Search users */}
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-heading font-semibold text-white mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-slate-400" /> View User Balances
              </h2>
              <div className="flex gap-3 mb-4">
                <Input
                  placeholder="Search by username…"
                  value={balSearch}
                  onChange={e => setBalSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchBalances()}
                  className="flex-1 max-w-xs"
                />
                <Button onClick={searchBalances} disabled={balSearching} variant="outline" className="gap-1.5">
                  <Search className="h-4 w-4" /> {balSearching ? 'Searching…' : 'Search'}
                </Button>
              </div>
              {balUsers.length > 0 && (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-navy-700">
                    {['Username','Balance','Admin','Joined'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {balUsers.map(u => (
                      <tr key={u.id} className="border-b border-navy-700/40 hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-white font-medium">
                          {u.username}
                          {u.is_admin && <span className="ml-2 text-[10px] text-amber-400 font-semibold">ADMIN</span>}
                        </td>
                        <td className="px-3 py-2.5 text-emerald-400 font-semibold">{formatUSD(u.usd_balance)}</td>
                        <td className="px-3 py-2.5 text-slate-400">{u.is_admin ? '✓' : '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{timeAgo(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {balUsers.length === 0 && balSearch && !balSearching && (
                <p className="text-slate-500 text-sm">No users found.</p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
