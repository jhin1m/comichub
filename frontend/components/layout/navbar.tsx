'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { PixelButton } from '@pxlkit/ui-kit';
import { useAuth } from '@/contexts/auth.context';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-16 sticky top-0 z-50 bg-[#0f0f0f] border-b border-[#2a2a2a]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-rajdhani font-bold text-xl text-[#f5f5f5]">
          Comic<span className="text-[#e63946]">Hub</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-[#a0a0a0] hover:text-[#f5f5f5] text-sm transition-colors">
            Home
          </Link>
          <Link href="/browse" className="text-[#a0a0a0] hover:text-[#f5f5f5] text-sm transition-colors">
            Browse
          </Link>
        </nav>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-[#2a2a2a] animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 focus:outline-none"
                aria-label="User menu"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border border-[#2a2a2a]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#e63946] flex items-center justify-center text-white text-sm font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg py-1 z-50">
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-[#f5f5f5] hover:bg-[#2e2e2e] transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => { setDropdownOpen(false); logout(); }}
                    className="w-full text-left px-4 py-2 text-sm text-[#a0a0a0] hover:bg-[#2e2e2e] hover:text-[#f5f5f5] transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login">
                <PixelButton tone="neutral" size="sm">Login</PixelButton>
              </Link>
              <Link href="/register">
                <PixelButton tone="red" size="sm">Register</PixelButton>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-[#a0a0a0] hover:text-[#f5f5f5]"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0f0f0f] border-b border-[#2a2a2a] px-4 py-3 flex flex-col gap-3">
          <Link href="/" className="text-sm text-[#a0a0a0] hover:text-[#f5f5f5]" onClick={() => setMenuOpen(false)}>
            Home
          </Link>
          <Link href="/browse" className="text-sm text-[#a0a0a0] hover:text-[#f5f5f5]" onClick={() => setMenuOpen(false)}>
            Browse
          </Link>
          {loading ? (
            <div className="w-20 h-5 rounded bg-[#2a2a2a] animate-pulse" />
          ) : user ? (
            <>
              <Link href="/profile" className="text-sm text-[#a0a0a0] hover:text-[#f5f5f5]" onClick={() => setMenuOpen(false)}>
                Profile
              </Link>
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="text-left text-sm text-[#a0a0a0] hover:text-[#f5f5f5]"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-[#a0a0a0] hover:text-[#f5f5f5]" onClick={() => setMenuOpen(false)}>
                Login
              </Link>
              <Link href="/register" className="text-sm text-[#e63946]" onClick={() => setMenuOpen(false)}>
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
