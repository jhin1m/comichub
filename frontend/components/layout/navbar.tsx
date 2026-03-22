'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Menu, X, Bell, LayoutGrid } from 'lucide-react';
import { SearchAutocomplete } from '@/components/layout/search-autocomplete';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth.context';
import { notificationApi } from '@/lib/api/notification.api';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notification unread count when logged in
  useEffect(() => {
    if (!user) return;
    notificationApi.getUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="h-14 sticky top-0 z-50 bg-base border-b border-default">
      <div className="max-w-350 mx-auto px-4 h-full flex items-center gap-3">

        {/* Logo */}
        <Link href="/" className="font-rajdhani font-bold text-xl text-primary shrink-0 mr-1">
          Comic<span className="text-accent">Hub</span>
        </Link>

        {/* Search (icon on mobile, full bar on desktop) */}
        <SearchAutocomplete />

        {/* Right action buttons — desktop */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          <Link
            href="/profile?tab=follows"
            className="w-9 h-9 flex items-center justify-center rounded text-secondary hover:bg-elevated hover:text-primary transition-colors"
            aria-label="Reading list"
          >
            <LayoutGrid size={18} />
          </Link>

          {user && (
            <button
              className="relative w-9 h-9 flex items-center justify-center rounded text-secondary hover:bg-elevated hover:text-primary transition-colors"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
              )}
            </button>
          )}

          {loading ? (
            <div className="w-8 h-8 rounded-full bg-hover animate-pulse" />
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center focus:outline-none"
                aria-label="User menu"
              >
                <Avatar
                  src={user.avatar ?? undefined}
                  fallback={user.name}
                  size="sm"
                  className="border border-default"
                />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-surface border border-default rounded shadow-lg py-1 z-50">
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-primary hover:bg-hover transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => { setDropdownOpen(false); logout(); }}
                    className="w-full text-left px-4 py-2 text-sm text-secondary hover:bg-hover hover:text-primary transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="h-9 px-4 border border-accent rounded text-accent text-[11px] font-bold tracking-widest uppercase hover:bg-accent hover:text-black transition-colors"
            >
              LOGIN
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-secondary hover:text-primary p-1"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-base border-b border-default px-4 py-3 flex flex-col gap-3">
          <Link href="/" className="text-sm text-secondary hover:text-primary" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/browse" className="text-sm text-secondary hover:text-primary" onClick={() => setMenuOpen(false)}>Browse</Link>
          {user ? (
            <>
              <Link href="/profile" className="text-sm text-secondary hover:text-primary" onClick={() => setMenuOpen(false)}>Profile</Link>
              <button onClick={() => { setMenuOpen(false); logout(); }} className="text-left text-sm text-secondary hover:text-primary">Logout</button>
            </>
          ) : (
            <Link href="/login" className="text-sm text-[#00d4d4]" onClick={() => setMenuOpen(false)}>Login</Link>
          )}
        </div>
      )}
    </header>
  );
}
