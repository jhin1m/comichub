'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import {
  BellIcon, SquaresFourIcon, TrendUpIcon, BookOpenIcon, LockIcon, SlidersHorizontalIcon,
  UserIcon, BookmarkSimpleIcon, ClockCounterClockwiseIcon, CurrencyCnyIcon, ListMagnifyingGlassIcon, SignOutIcon,
} from '@phosphor-icons/react';
import { SearchAutocomplete } from '@/components/layout/search-autocomplete';
import { Avatar } from '@/components/ui/avatar';
import { BrandLogo } from '@/components/ui/brand-logo';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth.context';
import { useUserSWR } from '@/lib/swr/use-user-swr';
import { SWR_KEYS } from '@/lib/swr/swr-keys';
import { NotificationDropdown } from '@/components/notification/notification-dropdown';
import { useNotificationStream } from '@/hooks/use-notification-stream';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [browseDropdownOpen, setBrowseDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { mutate } = useSWRConfig();

  // SWR cache is the single source of truth for the unread count. The
  // dropdown mutates the same key when the user opens it, marks items read,
  // or clears all — keeping navbar badge and dropdown view in sync without
  // a callback prop. useUserSWR auto-disables the fetch when user is null.
  const { data: unreadData } = useUserSWR<{ count: number }>(
    SWR_KEYS.NOTIFICATIONS_UNREAD_COUNT,
  );
  const unreadCount = unreadData?.count ?? 0;

  // SSE pushed a new notification → revalidate from the server. We do not
  // optimistically `+1` here because the server already authored the count
  // change; a fresh fetch avoids drift if multiple events race.
  const handleSseEvent = useCallback(() => {
    mutate(SWR_KEYS.NOTIFICATIONS_UNREAD_COUNT);
  }, [mutate]);
  useNotificationStream(handleSseEvent);
  const browseDropdownRef = useRef<HTMLDivElement>(null);

  // Close browse dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
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
        <Link href="/" className="shrink-0 mr-1">
          <BrandLogo />
        </Link>

        {/* Search (icon on mobile, full bar on desktop) */}
        <SearchAutocomplete />

        {/* Right action buttons — minimal, high-frequency only */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Browse menu */}
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
              <div role="menu" className="absolute right-0 mt-2 w-48 bg-elevated border border-default rounded-md shadow-lg py-1 z-50">
                <Link
                  href="/browse?sort=trending&type=manhwa"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-hover transition-colors"
                  onClick={() => setBrowseDropdownOpen(false)}
                >
                  <TrendUpIcon size={14} />
                  Trending Webtoon
                </Link>
                <Link
                  href="/browse?sort=trending&type=manhua"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-hover transition-colors"
                  onClick={() => setBrowseDropdownOpen(false)}
                >
                  <CurrencyCnyIcon size={14} />
                  Trending Manhua
                </Link>
                <Link
                  href="/browse?sort=trending&type=manga"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-hover transition-colors"
                  onClick={() => setBrowseDropdownOpen(false)}
                >
                  <BookOpenIcon size={14} />
                  Trending Manga
                </Link>
                <Link
                  href="/browse"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-hover transition-colors"
                  onClick={() => setBrowseDropdownOpen(false)}
                >
                  <ListMagnifyingGlassIcon size={14} />
                  Browse All Comic
                </Link>
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted cursor-not-allowed">
                  <LockIcon size={14} />
                  Popular Genres
                </div>
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted cursor-not-allowed">
                  <LockIcon size={14} />
                  Popular Groups
                </div>
              </div>
            )}
          </div>

          {/* Preferences — accessible to all users */}
          <Link
            href="/settings/preferences"
            className="w-9 h-9 flex items-center justify-center rounded text-secondary hover:bg-elevated hover:text-primary transition-colors"
            aria-label="Preferences"
          >
            <SlidersHorizontalIcon size={18} />
          </Link>

          {/* Notifications */}
          {user && (
            <NotificationDropdown
              open={notifOpen}
              onOpenChange={setNotifOpen}
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

          {/* User menu (Radix dropdown) or Login button */}
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-hover animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center focus:outline-none cursor-pointer" aria-label="User menu">
                  <Avatar
                    src={user.avatar ?? undefined}
                    fallback={user.name}
                    size="sm"
                    className="border border-default hover:border-accent transition-colors"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {/* User info header */}
                <DropdownMenuLabel className="px-3 py-2">
                  <p className="text-sm font-semibold text-primary truncate">{user.name}</p>
                  <p className="text-xs text-muted truncate mt-0.5">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/profile')}>
                  <UserIcon size={14} />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/profile?tab=bookmarks')}>
                  <BookmarkSimpleIcon size={14} />
                  Bookmarks
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/profile?tab=history')}>
                  <ClockCounterClockwiseIcon size={14} />
                  Reading History
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout()} className="text-secondary hover:text-primary">
                  <SignOutIcon size={14} />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="h-9 px-4 border border-accent rounded text-accent text-[11px] font-bold tracking-widest uppercase hover:bg-accent hover:text-black transition-colors cursor-pointer"
            >
              LOGIN
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
