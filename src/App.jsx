import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { Toaster } from '@/components/ui/toaster'
import AuthGate      from '@/components/AuthGate'
import Navbar        from '@/components/Navbar'
import Home          from '@/pages/Home'
import Listings      from '@/pages/Listings'
import Trade         from '@/pages/Trade'
import Dashboard     from '@/pages/Dashboard'
import CreateOffer   from '@/pages/CreateOffer'
import Deposit       from '@/pages/Deposit'
import Withdraw      from '@/pages/Withdraw'
import Admin         from '@/pages/Admin'
import AuthCallback  from '@/pages/AuthCallback'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/*
          /auth/callback must be reachable WITHOUT being authenticated
          (it's the page that receives the token after OAuth).
          Everything else is gated behind AuthGate.
        */}
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route path="*" element={
            <AuthGate>
              <Navbar />
              <Routes>
                <Route path="/"             element={<Home />} />
                <Route path="/listings"     element={<Listings />} />
                <Route path="/trade/:id"    element={<Trade />} />
                <Route path="/dashboard"    element={<Dashboard />} />
                <Route path="/create-offer" element={<CreateOffer />} />
                <Route path="/deposit"      element={<Deposit />} />
                <Route path="/withdraw"     element={<Withdraw />} />
                <Route path="/admin"        element={<Admin />} />
                <Route path="*" element={
                  <div className="page-bg min-h-screen pt-20 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-6xl font-brand text-brand-400 mb-4">404</p>
                      <p className="text-white text-xl font-heading mb-2">Page not found</p>
                      <a href="/" className="text-brand-400 hover:text-brand-300 text-sm underline">Go home</a>
                    </div>
                  </div>
                } />
              </Routes>
            </AuthGate>
          } />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}
