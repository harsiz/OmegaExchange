import { Loader2 } from 'lucide-react'
import { loginWithOmegaCases } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

/**
 * Blocks the entire app until the user is authenticated.
 * Shows a loading spinner while the token is being verified,
 * then a login screen if no valid session exists.
 */
export default function AuthGate({ children }) {
  const { user, loading } = useAuth()

  // 1 — Checking token / fetching user
  if (loading) {
    return (
      <div className="hero-bg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/oc-logo.webp" alt="OmegaExchange" className="h-14 w-14 object-contain animate-pulse" />
          <Loader2 className="h-6 w-6 text-brand-400 animate-spin" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  // 2 — Not logged in → login screen
  if (!user) {
    return (
      <div className="hero-bg min-h-screen flex flex-col items-center justify-center px-4">
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-600/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <img src="/oc-logo.webp" alt="OmegaExchange" className="h-12 w-12 object-contain" />
            <span className="font-brand text-3xl font-bold text-white">OmegaExchange</span>
          </div>

          {/* Card */}
          <div className="widget-card w-full px-8 py-10">
            <h1 className="font-heading text-2xl font-bold text-navy-900 mb-2">
              Sign in to continue
            </h1>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              OmegaExchange uses OmegaCases for authentication.
              Sign in with your OmegaCases account to buy, sell, and trade crypto safely.
            </p>

            <Button
              onClick={loginWithOmegaCases}
              className="w-full h-12 text-base font-bold gap-2"
            >
              {/* OC logo inline */}
              <img src="/oc-logo.webp" alt="" className="h-5 w-5 object-contain brightness-0 invert" />
              Sign in with OmegaCases
            </Button>

            <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
              By signing in you agree to our Terms of Use and Privacy Policy.
              Your OmegaCases account is required — no separate sign-up needed.
            </p>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-5 mt-8 text-xs text-slate-600">
            <span>🔒 Escrow Protected</span>
            <span>·</span>
            <span>⚡ Instant Trades</span>
            <span>·</span>
            <span>🛡 Dispute Resolution</span>
          </div>
        </div>
      </div>
    )
  }

  // 3 — Authenticated → render the app
  return children
}
