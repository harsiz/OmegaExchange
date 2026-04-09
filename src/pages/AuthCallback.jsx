import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const OC_ME_URL = 'https://www.omegacases.com/api/oauth/me'

export default function AuthCallback() {
  const navigate           = useNavigate()
  const [params]           = useSearchParams()
  const { loginWithToken } = useAuth()
  const [status,  setStatus]  = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')
    const error = params.get('error')

    if (error) {
      setStatus('error')
      setMessage(error === 'access_denied' ? 'Access denied. Please try again.' : decodeURIComponent(error))
      return
    }

    if (!token) {
      setStatus('error')
      setMessage('No token received. Please try logging in again.')
      return
    }

    // If it looks like a JWT (header.payload.signature), use it directly
    if (token.includes('.')) {
      try {
        loginWithToken(token)
        setStatus('success')
        setTimeout(() => navigate('/', { replace: true }), 1200)
      } catch {
        setStatus('error')
        setMessage('Failed to process login token. Please try again.')
      }
      return
    }

    // Otherwise it's a raw OmegaCases token — browser fetches user info directly
    // (browser has OmegaCases session cookies, Vercel IPs are blocked by Cloudflare)
    async function doExchange() {
      try {
        const meRes = await fetch(`${OC_ME_URL}?token=${encodeURIComponent(token)}`)
        if (!meRes.ok) throw new Error(`OmegaCases returned ${meRes.status}`)

        const userData = await meRes.json()
        const userId   = String(userData.user_id || userData.id || userData.userid || '')
        const username = userData.username || userData.name

        if (!userId || !username) {
          throw new Error(`Could not read user info: ${JSON.stringify(userData)}`)
        }

        // Send to our backend to issue a signed JWT
        const exchangeRes = await fetch('/api/auth/exchange', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ oc_token: token, user_id: userId, username }),
        })
        const exchangeData = await exchangeRes.json()
        if (!exchangeRes.ok || !exchangeData.token) {
          throw new Error(exchangeData.error || 'Exchange failed')
        }

        loginWithToken(exchangeData.token)
        setStatus('success')
        setTimeout(() => navigate('/', { replace: true }), 1200)
      } catch (err) {
        console.error('Auth exchange error:', err)
        setStatus('error')
        setMessage(err.message || 'Sign-in failed. Please try again.')
      }
    }

    doExchange()
  }, [params, loginWithToken, navigate])

  return (
    <div className="hero-bg min-h-screen flex items-center justify-center">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-brand-400 animate-spin mx-auto mb-4" />
            <p className="text-white font-heading text-lg font-semibold">Signing you in…</p>
            <p className="text-slate-400 text-sm mt-1">Verifying your OmegaCases account</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-white font-heading text-lg font-semibold">Signed in!</p>
            <p className="text-slate-400 text-sm mt-1">Redirecting to homepage…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-white font-heading text-lg font-semibold">Sign-in Failed</p>
            <p className="text-slate-400 text-sm mt-1 max-w-xs">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 text-brand-400 hover:text-brand-300 text-sm underline"
            >
              Back to homepage
            </button>
          </>
        )}
      </div>
    </div>
  )
}
