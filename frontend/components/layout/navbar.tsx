'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ListIcon, XIcon, BellIcon, SquaresFourIcon, FadersHorizontalIcon, TrendUpIcon, BookOpenIcon, LockIcon } from '@phosphor-icons/react';
import { SearchAutocomplete } from '@/components/layout/search-autocomplete';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth.context';
import { notificationApi } from '@/lib/api/notification.api';
import { NotificationDropdown } from '@/components/notification/notification-dropdown';
import { useNotificationStream } from '@/hooks/use-notification-stream';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [browseDropdownOpen, setBrowseDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchUnreadCount = useCallback(() => {
    notificationApi.getUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
  }, []);

  // SSE: just +1 locally, no API call. Dropdown close syncs real count.
  const handleSseEvent = useCallback(() => {
    setUnreadCount((c) => c + 1);
  }, []);
  useNotificationStream(handleSseEvent);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const browseDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch once when user logs in
  useEffect(() => {
    if (user) fetchUnreadCount();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (browseDropdownRef.current && !browseDropdownRef.current.contains(e.target as Node)) {
        setBrowseDropdownOpen(false);
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
          <div className="relative" ref={browseDropdownRef}>
            <button
              onClick={() => setBrowseDropdownOpen((v) => !v)}
              className="w-9 h-9 flex items-center justify-center rounded text-secondary hover:bg-elevated hover:text-primary transition-colors"
              aria-label="Browse menu"
              aria-haspopup="menu"
              aria-expanded={browseDropdownOpen}
            >
              <SquaresFourIcon size={18} />
            </button>
            {browseDropdownOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-48 bg-surface border border-default rounded shadow-lg py-1 z-50">
                <Link
                  href="/browse?sort=trending&type=manhwa"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-secondary hover:bg-hover hover:text-primary transition-colors"
                  onClick={() => setBrowseDropdownOpen(false)}
                >
                  <TrendUpIcon size={14} />
                  Trending Webtoon
                </Link>
                <Link
                  href="/browse?sort=trending&type=manga"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-secondary hover:bg-hover hover:text-primary transition-colors"
                  onClick={() => setBrowseDropdownOpen(false)}
                >
                  <BookOpenIcon size={14} />
                  Trending Manga
                </Link>
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted cursor-not-allowed">
                  <LockIcon size={14} />
                  Popular Genres
                </div>
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted cursor-not-allowed">
                  <LockIcon size={14} />
                  Popular Groups
                </div>
              </div>
            )}
          </div>

          <Link
            href="/settings/preferences"
            className="w-9 h-9 flex items-center justify-center rounded text-secondary hover:bg-elevated hover:text-primary transition-colors"
            aria-label="Preferences"
          >
            <FadersHorizontalIcon size={18} />
          </Link>

          {user && (
            <NotificationDropdown
              open={notifOpen}
              onOpenChange={setNotifOpen}
              onUnreadCountChange={setUnreadCount}
            >
              <button
                className="relative w-9 h-9 flex items-center justify-center rounded text-secondary hover:bg-elevated hover:text-primary transition-colors"
                aria-label="Notifications"
              >
                <BellIcon size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center bg-accent text-black text-[10px] font-bold rounded-full leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </NotificationDropdown>
          )}

          {loading ? (
            <div className="w-8 h-8 rounded-full bg-hover animate-pulse" />
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center focus:outline-none"
                aria-label="User menu"
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
              >
                <Avatar
                  src={user.avatar ?? undefined}
                  fallback={user.name}
                  size="sm"
                  className="border border-default"
                />
              </button>
              {dropdownOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-44 bg-surface border border-default rounded shadow-lg py-1 z-50">
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
          {menuOpen ? <XIcon size={20} /> : <ListIcon size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-base border-b border-default px-4 py-3 flex flex-col gap-3">
          <Link href="/" className="text-sm text-secondary hover:text-primary" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/browse" className="text-sm text-secondary hover:text-primary" onClick={() => setMenuOpen(false)}>Browse</Link>
          <Link href="/browse?sort=trending&type=manhwa" className="text-sm text-secondary hover:text-primary pl-3" onClick={() => setMenuOpen(false)}>Trending Webtoon</Link>
          <Link href="/browse?sort=trending&type=manga" className="text-sm text-secondary hover:text-primary pl-3" onClick={() => setMenuOpen(false)}>Trending Manga</Link>
          <Link href="/settings/preferences" className="text-sm text-secondary hover:text-primary" onClick={() => setMenuOpen(false)}>Preferences</Link>
          {user ? (
            <>
              <Link href="/profile" className="text-sm text-secondary hover:text-primary" onClick={() => setMenuOpen(false)}>Profile</Link>
              <button onClick={() => { setMenuOpen(false); logout(); }} className="text-left text-sm text-secondary hover:text-primary">Logout</button>
            </>
          ) : (
            <Link href="/login" className="text-sm text-accent" onClick={() => setMenuOpen(false)}>Login</Link>
          )}
        </div>
      )}
    </header>
  );
}
