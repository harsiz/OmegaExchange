import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Shield, Send, AlertTriangle, CheckCircle, Clock,
  ArrowRight, Copy, Check, RefreshCw,
} from 'lucide-react'
import { tradesApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { CryptoIcon } from '@/components/CryptoIcon'
import { formatUSD, formatCrypto, getStatusLabel, timeAgo, shortenId } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

const STATUS_STEPS = ['pending', 'paid', 'completed']

function StatusStep({ step, current }) {
  const steps = ['pending', 'paid', 'completed']
  const idx    = steps.indexOf(step)
  const curIdx = steps.indexOf(current)
  const done   = curIdx > idx
  const active = curIdx === idx

  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${done ? 'text-emerald-400' : active ? 'text-white' : 'text-slate-600'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
        ${done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-600 text-white ring-2 ring-brand-400/40' : 'bg-navy-700 text-slate-500'}`}>
        {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
      </div>
      <span className="capitalize">{getStatusLabel(step)}</span>
    </div>
  )
}

export default function TradePage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const [trade,         setTrade]         = useState(null)
  const [messages,      setMessages]      = useState([])
  const [messageInput,  setMessageInput]  = useState('')
  const [loading,       setLoading]       = useState(true)
  const [sending,       setSending]       = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [disputeOpen,   setDisputeOpen]   = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [copied,        setCopied]        = useState(false)
  const chatBottomRef = useRef(null)

  const fetchTrade = useCallback(async () => {
    try {
      const [tradeRes, msgRes] = await Promise.all([
        tradesApi.get(id),
        tradesApi.getMessages(id),
      ])
      setTrade(tradeRes.data.trade)
      setMessages(msgRes.data.messages || [])
    } catch (err) {
      // Don't navigate away — show the error inline so the user knows what happened
      console.error('fetchTrade error:', err)
      if (!trade) toast({ title: 'Could not load trade', description: err.response?.data?.error || err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id]) // removed navigate from deps so failed polls don't bounce the user

  useEffect(() => { fetchTrade() }, [fetchTrade])

  // Auto-scroll chat
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Poll for updates every 10s
  useEffect(() => {
    const iv = setInterval(fetchTrade, 10_000)
    return () => clearInterval(iv)
  }, [fetchTrade])

  async function sendMessage(e) {
    e.preventDefault()
    if (!messageInput.trim()) return
    setSending(true)
    try {
      const { data } = await tradesApi.sendMessage(id, messageInput.trim())
      setMessages(m => [...m, data.message])
      setMessageInput('')
    } catch {
      toast({ title: 'Failed to send', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  async function handleAction(action, opts = {}) {
    setActionLoading(true)
    try {
      let res
      if (action === 'confirm')  res = await tradesApi.confirmPayment(id)
      if (action === 'release')  res = await tradesApi.release(id)
      if (action === 'dispute')  res = await tradesApi.dispute(id, opts)
      if (action === 'cancel')   res = await tradesApi.cancel(id)
      setTrade(res.data.trade)
      toast({ title: res.data.message || 'Done', variant: 'success' })
      setDisputeOpen(false)
    } catch (err) {
      toast({ title: 'Action failed', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  function copyId() {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  if (!trade) return null

  const isBuyer  = user?.id === trade.buyer_id
  const isSeller = user?.id === trade.seller_id
  const isActive = ['pending', 'paid'].includes(trade.status)

  return (
    <div className="page-bg min-h-screen pt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-heading text-xl font-bold text-white">Trade #{shortenId(trade.id)}</h1>
              <Badge variant={trade.status}>{getStatusLabel(trade.status)}</Badge>
            </div>
            <button onClick={copyId} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {trade.id}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTrade}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Left: trade info */}
          <div className="lg:col-span-2 space-y-4">

            {/* Trade summary card */}
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-heading font-semibold text-white mb-4">Trade Summary</h2>

              <div className="flex items-center gap-3 mb-4">
                <CryptoIcon symbol={trade.currency || 'BTC'} size={32} />
                <div>
                  <p className="text-2xl font-bold text-white font-heading">
                    {formatCrypto(trade.amount, trade.currency)} {trade.currency}
                  </p>
                  <p className="text-sm text-slate-400">{formatUSD(trade.amount * trade.price)} total</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Price per unit</span>
                  <span className="text-white font-medium">{formatUSD(trade.price)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Amount</span>
                  <span className="text-white font-medium">{formatCrypto(trade.amount, trade.currency)} {trade.currency}</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-2 border-t border-navy-700">
                  <span>Total USD</span>
                  <span className="text-white font-bold">{formatUSD(trade.amount * trade.price)}</span>
                </div>
              </div>

              {/* Escrow indicator */}
              <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                trade.escrow_locked ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
              }`}>
                <Shield className="h-4 w-4" />
                {trade.escrow_locked ? 'Crypto locked in escrow' : 'Awaiting escrow lock'}
              </div>
            </div>

            {/* Trade parties */}
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-heading font-semibold text-white mb-4">Parties</h2>
              <div className="space-y-3">
                {[
                  { label: 'Buyer',  id: trade.buyer_id,  username: trade.buyer?.username,  you: isBuyer },
                  { label: 'Seller', id: trade.seller_id, username: trade.seller?.username, you: isSeller },
                ].map(p => (
                  <div key={p.label} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{p.username?.slice(0, 2).toUpperCase() ?? '??'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {p.username ?? 'Unknown'}
                        {p.you && <span className="ml-2 text-xs text-brand-400">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-500">{p.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div className="glass-card rounded-xl p-5">
              <h2 className="font-heading font-semibold text-white mb-4">Progress</h2>
              <div className="space-y-3">
                {['pending', 'paid', 'completed'].map(s => (
                  <StatusStep key={s} step={s} current={trade.status} />
                ))}
              </div>
            </div>

            {/* Payment instructions */}
            {isBuyer && trade.status === 'pending' && trade.payment_instructions && (
              <div className="glass-card rounded-xl p-5">
                <h2 className="font-heading font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" /> Payment Instructions
                </h2>
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {trade.payment_instructions}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              {isBuyer && trade.status === 'pending' && (
                <Button
                  onClick={() => handleAction('confirm')}
                  disabled={actionLoading}
                  className="w-full gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  I've Sent Payment
                </Button>
              )}

              {isSeller && trade.status === 'paid' && (
                <Button
                  onClick={() => handleAction('release')}
                  disabled={actionLoading}
                  variant="success"
                  className="w-full gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  Release Crypto to Buyer
                </Button>
              )}

              {isActive && (
                <>
                  <Button
                    onClick={() => setDisputeOpen(true)}
                    variant="outline"
                    className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-950 hover:text-red-300"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Open Dispute
                  </Button>

                  {isBuyer && trade.status === 'pending' && (
                    <Button
                      onClick={() => handleAction('cancel')}
                      variant="ghost"
                      className="w-full text-slate-500 hover:text-red-400"
                      disabled={actionLoading}
                    >
                      Cancel Trade
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: chat */}
          <div className="lg:col-span-3 glass-card rounded-xl flex flex-col" style={{ minHeight: '500px', maxHeight: '680px' }}>
            <div className="p-4 border-b border-navy-700">
              <h2 className="font-heading font-semibold text-white">Trade Chat</h2>
              <p className="text-xs text-slate-500 mt-0.5">Communicate with your trade partner</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8 text-slate-600 text-sm">
                  No messages yet. Say hello!
                </div>
              )}
              {messages.map(msg => {
                const mine = msg.sender_id === user?.id
                return (
                  <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!mine && (
                        <span className="text-xs text-slate-500 px-1">{msg.sender?.username ?? 'Unknown'}</span>
                      )}
                      <div className={`px-4 py-2.5 text-sm ${mine ? 'chat-bubble-mine' : 'chat-bubble-theirs'}`}>
                        {msg.message}
                      </div>
                      <span className="text-[10px] text-slate-600 px-1">{timeAgo(msg.created_at)}</span>
                    </div>
                  </div>
                )
              })}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            {isActive ? (
              <form onSubmit={sendMessage} className="p-4 border-t border-navy-700 flex gap-2">
                <Input
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1"
                  maxLength={500}
                />
                <Button type="submit" disabled={sending || !messageInput.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <div className="p-4 border-t border-navy-700 text-center text-sm text-slate-600">
                Trade {trade.status} — chat closed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dispute dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" /> Open a Dispute
            </DialogTitle>
            <DialogDescription>
              Describe the issue. Our moderation team will review and intervene within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={disputeReason}
            onChange={e => setDisputeReason(e.target.value)}
            placeholder="Explain what went wrong…"
            rows={4}
            className="w-full rounded-lg border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!disputeReason.trim() || actionLoading}
              onClick={() => handleAction('dispute', { reason: disputeReason })}
            >
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
