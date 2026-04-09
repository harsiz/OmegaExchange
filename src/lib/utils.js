import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const CURRENCIES = [
  { symbol: 'BTC',  name: 'Bitcoin',      color: '#F7931A', bgColor: '#F7931A20' },
  { symbol: 'ETH',  name: 'Ethereum',     color: '#627EEA', bgColor: '#627EEA20' },
  { symbol: 'SOL',  name: 'Solana',       color: '#9945FF', bgColor: '#9945FF20' },
  { symbol: 'USDT', name: 'Tether',       color: '#26A17B', bgColor: '#26A17B20' },
  { symbol: 'USDC', name: 'USD Coin',     color: '#2775CA', bgColor: '#2775CA20' },
  { symbol: 'LTC',  name: 'Litecoin',     color: '#345D9D', bgColor: '#345D9D20' },
  { symbol: 'BCH',  name: 'Bitcoin Cash', color: '#8DC351', bgColor: '#8DC35120' },
]

export const PAYMENT_METHODS = [
  'PayPal',
  'Bank Transfer',
  'Revolut',
  'Cashapp',
  'Zelle',
  'Venmo',
  'Google Pay',
  'Apple Pay',
  'Gift Card',
  'Wise',
  'Skrill',
  'SEPA',
]

export function getCurrency(symbol) {
  return CURRENCIES.find(c => c.symbol === symbol) || CURRENCIES[0]
}

export function formatUSD(amount) {
  if (amount == null) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCrypto(amount, symbol = '') {
  if (amount == null) return '0'
  const decimals = symbol === 'BTC' ? 8 : symbol === 'ETH' ? 6 : 4
  return Number(amount).toFixed(decimals).replace(/\.?0+$/, '')
}

export function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function getCompletionRate(rep) {
  if (!rep || rep.total_trades === 0) return 100
  return Math.round((rep.successful_trades / rep.total_trades) * 100)
}

export function getStatusLabel(status) {
  const map = {
    pending:   'Awaiting Payment',
    paid:      'Payment Sent',
    completed: 'Completed',
    disputed:  'In Dispute',
    cancelled: 'Cancelled',
  }
  return map[status] || status
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function shortenId(id) {
  if (!id) return ''
  return id.slice(0, 8).toUpperCase()
}
