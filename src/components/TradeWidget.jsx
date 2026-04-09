import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CryptoIcon } from '@/components/CryptoIcon'
import { CURRENCIES, formatUSD } from '@/lib/utils'

// Mock prices (replace with real API in production)
const MOCK_PRICES = { BTC: 82400, ETH: 1840, LTC: 88, SOL: 120, USDT: 1, XRP: 2.1 }

const PAYMENT_ICONS = [
  { label: 'Visa/MC',   img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png' },
  { label: 'PayPal',    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/2560px-PayPal.svg.png' },
  { label: 'Revolut',   img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Revolut_logo_2021.svg/2560px-Revolut_logo_2021.svg.png' },
  { label: 'Cashapp',   img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Square_Cash_app_logo.svg/2048px-Square_Cash_app_logo.svg.png' },
]

export default function TradeWidget({ defaultTab = 'buy' }) {
  const navigate = useNavigate()
  const [tab,          setTab]          = useState(defaultTab) // 'buy' | 'sell'
  const [sendAmount,   setSendAmount]   = useState('500')
  const [getCurrency,  setGetCurrency]  = useState('BTC')
  const [sendCurrency, setSendCurrency] = useState('USD')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const price = MOCK_PRICES[getCurrency] || 1
  const cryptoAmount = parseFloat(sendAmount || 0) / price

  function handleSubmit() {
    const params = new URLSearchParams({
      currency: getCurrency,
      amount:   sendAmount,
      tab,
    })
    navigate(`/listings?${params.toString()}`)
  }

  return (
    <div className="widget-card w-full max-w-sm mx-auto p-0 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        {['buy', 'sell'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-4 text-sm font-bold capitalize transition-colors ${
              tab === t
                ? 'text-brand-600 border-b-2 border-brand-600 -mb-px'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => navigate('/listings')}
          className="flex-1 py-4 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
        >
          Browse
        </button>
      </div>

      <div className="p-5 space-y-3">
        {/* You send */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500 mb-2 font-medium">You {tab === 'buy' ? 'spend' : 'receive'}</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-sm min-w-fit">
              <span className="text-base">🇺🇸</span>
              <span>USD</span>
            </div>
            <input
              type="number"
              value={sendAmount}
              onChange={e => setSendAmount(e.target.value)}
              className="flex-1 bg-transparent text-right text-xl font-bold text-slate-800 outline-none w-0"
              placeholder="0"
              min="1"
            />
          </div>
        </div>

        {/* Swap arrow */}
        <div className="flex justify-center">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <ArrowDownUp className="h-4 w-4 text-slate-500" />
          </div>
        </div>

        {/* You get */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500 mb-2 font-medium">You {tab === 'buy' ? 'receive' : 'send'}</p>
          <div className="flex items-center gap-3">
            {/* Currency selector */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="flex items-center gap-1.5 text-slate-700 font-semibold text-sm hover:bg-slate-200 rounded-lg px-2 py-1 transition-colors"
              >
                <CryptoIcon symbol={getCurrency} size={20} />
                <span>{getCurrency}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-20 min-w-[140px] py-1">
                  {CURRENCIES.map(c => (
                    <button
                      key={c.symbol}
                      onClick={() => { setGetCurrency(c.symbol); setDropdownOpen(false) }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium"
                    >
                      <CryptoIcon symbol={c.symbol} size={18} />
                      <span>{c.symbol}</span>
                      <span className="text-slate-400 text-xs">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 text-right">
              <span className="text-xl font-bold text-slate-800">
                ≈ {cryptoAmount > 0 ? cryptoAmount.toFixed(6).replace(/\.?0+$/, '') : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Payment methods */}
        <div>
          <p className="text-xs text-slate-500 mb-2 font-medium">Payment methods</p>
          <div className="flex items-center gap-2 flex-wrap">
            {PAYMENT_ICONS.map(p => (
              <div key={p.label} className="h-7 px-2 rounded-full border border-slate-200 flex items-center justify-center bg-white">
                <span className="text-xs font-semibold text-slate-600">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            {sendAmount || 0} USD → {cryptoAmount > 0 ? cryptoAmount.toFixed(6).replace(/\.?0+$/, '') : '—'} {getCurrency}
          </span>
          <span className="text-brand-600 font-medium cursor-pointer hover:underline">Details ∨</span>
        </div>

        {/* CTA */}
        <Button
          onClick={handleSubmit}
          className="w-full h-12 text-base font-bold rounded-xl bg-brand-600 hover:bg-brand-700"
        >
          {tab === 'buy' ? `Find ${getCurrency} Sellers` : 'Create Sell Offer'}
        </Button>
      </div>
    </div>
  )
}
