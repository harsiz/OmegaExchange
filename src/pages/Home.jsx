import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Zap, Users, ArrowRight, TrendingUp, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import TradeWidget from '@/components/TradeWidget'
import Footer from '@/components/Footer'
import { CryptoIcon } from '@/components/CryptoIcon'
import { Button } from '@/components/ui/button'
import { CURRENCIES, formatUSD } from '@/lib/utils'

const COINGECKO_IDS = {
  BTC:  'bitcoin',
  ETH:  'ethereum',
  SOL:  'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  LTC:  'litecoin',
  BCH:  'bitcoin-cash',
}

function useLivePrices() {
  const [prices,  setPrices]  = useState({})
  const [changes, setChanges] = useState({})

  useEffect(() => {
    const ids = Object.values(COINGECKO_IDS).join(',')
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`)
      .then(r => r.json())
      .then(data => {
        const p = {}, c = {}
        for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
          p[sym] = data[id]?.usd ?? 0
          c[sym] = parseFloat((data[id]?.usd_24h_change ?? 0).toFixed(2))
        }
        setPrices(p)
        setChanges(c)
      })
      .catch(() => {})
  }, [])

  return { prices, changes }
}

const FEATURES = [
  {
    icon: Shield,
    title: 'Escrow Protection',
    desc: "Seller's crypto is locked before you pay. Funds only release when you confirm — or an admin intervenes.",
  },
  {
    icon: Users,
    title: 'Real People, Real Trades',
    desc: 'Browse offers from verified sellers with reputation scores, completion rates, and trade history.',
  },
  {
    icon: Zap,
    title: 'Fast & Flexible',
    desc: 'Pay with PayPal, gift cards, bank transfer, or cash. Dozens of payment methods supported.',
  },
  {
    icon: Lock,
    title: 'Dispute Resolution',
    desc: 'If something goes wrong, our moderation team steps in to review the trade and release funds fairly.',
  },
]

const STEPS = [
  { num: '01', title: 'Deposit Funds',          desc: 'Add USD to your on-site balance via the deposit page.' },
  { num: '02', title: 'Find an Offer',          desc: 'Browse listings sorted by best price. Filter by coin.' },
  { num: '03', title: 'Start a Trade',          desc: 'Click Buy — your USD is locked in escrow instantly.' },
  { num: '04', title: 'Seller Sends Crypto',    desc: 'The seller sends crypto to your wallet and marks it sent.' },
  { num: '05', title: 'Confirm & Get Paid',     desc: 'You confirm receipt — escrow releases USD to the seller.' },
]

export default function Home() {
  const { prices, changes } = useLivePrices()

  return (
    <div className="hero-bg min-h-screen">
      {/* Hero */}
      <section className="pt-28 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left: copy */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-600/15 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
                P2P Crypto · Escrow Protected
              </div>

              <h1 className="font-heading text-5xl sm:text-6xl font-bold leading-tight text-white mb-5">
                Buy Crypto
                <span className="block gradient-text">Safely & Easily</span>
              </h1>

              <p className="text-lg text-slate-400 max-w-md leading-relaxed mb-8">
                OmegaExchange connects buyers and sellers with an escrow system that keeps every trade safe.
                Deposit USD, find your price, get crypto — in minutes.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/listings">
                  <Button size="lg" className="gap-2 w-full sm:w-auto">
                    Browse Offers <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/create-offer">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Sell Crypto
                  </Button>
                </Link>
              </div>

            </motion.div>

            {/* Right: widget */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="flex justify-center lg:justify-end"
            >
              <TradeWidget />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Live prices ticker */}
      <section className="border-y border-navy-800 bg-navy-900/40 py-4 overflow-hidden">
        <div className="flex gap-8 px-4 overflow-x-auto no-scrollbar">
          {CURRENCIES.map(c => {
            const price  = prices[c.symbol]
            const change = changes[c.symbol] ?? 0
            return (
              <div key={c.symbol} className="flex items-center gap-2.5 flex-shrink-0">
                <CryptoIcon symbol={c.symbol} size={22} />
                <div>
                  <span className="text-sm font-bold text-white">{c.symbol}</span>
                  <span className="text-xs text-slate-400 ml-1.5">
                    {price ? formatUSD(price) : '—'}
                  </span>
                </div>
                {price > 0 && (
                  <span className={`text-xs font-semibold ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {change >= 0 ? '+' : ''}{change}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-white mb-3">Why OmegaExchange?</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Built for people who want full control over their crypto — with the safety net of escrow.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="glass-card rounded-xl p-5">
                <div className="w-10 h-10 rounded-xl bg-brand-600/15 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-brand-400" />
                </div>
                <h3 className="font-heading font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-navy-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-white mb-3">How It Works</h2>
            <p className="text-slate-400">From deposit to crypto — here's the full flow.</p>
          </div>
          <div className="relative">
            {/* Connector line */}
            <div className="hidden md:block absolute left-[30px] top-8 bottom-8 w-px bg-gradient-to-b from-brand-600/50 via-brand-600/20 to-transparent" />
            <div className="space-y-6">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-5"
                >
                  <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center">
                    <span className="font-brand text-brand-400 text-lg font-bold">{step.num}</span>
                  </div>
                  <div className="pt-3">
                    <h3 className="font-heading font-semibold text-white mb-1">{step.title}</h3>
                    <p className="text-sm text-slate-400">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="text-center mt-10">
            <Link to="/deposit">
              <Button size="lg" className="gap-2">
                Deposit Funds <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Supported coins */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-heading text-2xl font-bold text-white mb-8 text-center">Supported Assets</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {CURRENCIES.map(c => (
              <div key={c.symbol} className="glass-card rounded-xl p-4 flex flex-col items-center gap-2 hover:border-brand-600/30 transition-colors cursor-pointer">
                <CryptoIcon symbol={c.symbol} size={36} />
                <span className="font-semibold text-white text-sm">{c.symbol}</span>
                <span className="text-xs text-slate-500">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
