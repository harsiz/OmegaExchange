import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ChevronDown, Wallet, LogOut, LayoutDashboard, PlusCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { loginWithOmegaCases } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import OmegaExchangeText from '@/components/OmegaExchangeText'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_LINKS = [
  { label: 'Buy',     href: '/listings?tab=buy'  },
  { label: 'Sell',    href: '/create-offer'       },
  { label: 'Markets', href: '/listings'           },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = href => location.pathname === href.split('?')[0]

  return (
    <nav className="fixed top-0 left-0 right-0 z-40">
      {/* Backdrop blur bar */}
      <div className="border-b border-white/5 bg-navy-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src="/oc-logo.webp" alt="OmegaExchange" className="h-8 w-8 object-contain" />
              <OmegaExchangeText className="text-xl" />
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive(link.href)
                      ? 'text-white bg-white/8'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right side */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <Link to="/deposit">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Wallet className="h-4 w-4" />
                      Deposit
                    </Button>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {user.username?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-slate-200">{user.username}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-navy-800 border-navy-700">
                      <DropdownMenuItem asChild className="hover:bg-navy-700 cursor-pointer">
                        <Link to="/dashboard" className="flex items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" /> Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="hover:bg-navy-700 cursor-pointer">
                        <Link to="/create-offer" className="flex items-center gap-2">
                          <PlusCircle className="h-4 w-4" /> Create Offer
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="hover:bg-navy-700 cursor-pointer">
                        <Link to="/deposit" className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" /> Deposit Funds
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-navy-700" />
                      <DropdownMenuItem
                        onClick={logout}
                        className="text-red-400 hover:bg-red-950 hover:text-red-300 cursor-pointer flex items-center gap-2"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button onClick={loginWithOmegaCases} size="sm">
                  Get Started
                </Button>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-navy-900/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-navy-700">
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-slate-300 hover:text-white">Dashboard</Link>
                  <button onClick={() => { logout(); setMobileOpen(false) }} className="block w-full text-left px-3 py-2 text-sm text-red-400">Sign Out</button>
                </>
              ) : (
                <Button onClick={() => { loginWithOmegaCases(); setMobileOpen(false) }} className="w-full mt-1">
                  Get Started
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
