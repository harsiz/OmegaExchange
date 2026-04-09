import { Link } from 'react-router-dom'
import { Shield, Lock, Zap } from 'lucide-react'
import OmegaExchangeText from '@/components/OmegaExchangeText'

export default function Footer() {
  return (
    <footer className="border-t border-navy-800 bg-navy-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <img src="/oc-logo.webp" alt="" className="h-7 w-7" />
              <OmegaExchangeText className="text-lg" />
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed">
              The safest peer-to-peer crypto marketplace. Trade with confidence.
            </p>
            <div className="flex gap-3 mt-4">
              {[
                { icon: Shield, label: 'Escrow Protected' },
                { icon: Lock,   label: 'Secure' },
                { icon: Zap,    label: 'Fast' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1 text-xs text-slate-500">
                  <Icon className="h-3.5 w-3.5 text-brand-400" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trade */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Trade</h4>
            <ul className="space-y-2">
              {[
                ['Buy Crypto',    '/listings?tab=buy'],
                ['Sell Crypto',   '/create-offer'],
                ['All Listings',  '/listings'],
                ['My Dashboard',  '/dashboard'],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link to={href} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Assets */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Assets</h4>
            <ul className="space-y-2">
              {['Bitcoin (BTC)', 'Ethereum (ETH)', 'Litecoin (LTC)', 'Solana (SOL)', 'Tether (USDT)'].map(a => (
                <li key={a}>
                  <span className="text-sm text-slate-500">{a}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Support</h4>
            <ul className="space-y-2">
              {[
                ['Deposit Funds',  '/deposit'],
                ['FAQ',            '#'],
                ['Contact',        '#'],
                ['Terms of Use',   '#'],
                ['Privacy Policy', '#'],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link to={href} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-navy-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">© 2026 OmegaExchange. All rights reserved.</p>
          <p className="text-xs text-slate-600">Powered by OmegaCases OAuth · Supabase · Tatum</p>
        </div>
      </div>
    </footer>
  )
}
