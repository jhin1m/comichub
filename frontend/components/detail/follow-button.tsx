'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BookmarkSimpleIcon, CaretDownIcon, CheckIcon, TrashIcon, SpinnerIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useSWRConfig } from 'swr';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import { useAuth } from '@/contexts/auth.context';
import { SWR_KEYS } from '@/lib/swr/swr-keys';
import type { BookmarkFolder, BookmarkStatus } from '@/types/bookmark.types';
import type { AuthUser } from '@/types/auth.types';

interface Props {
  mangaId: number;
  followersCount: number;
}

export function FollowButton({ mangaId, followersCount }: Props) {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const [status, setStatus] = useState<BookmarkStatus>({
    bookmarked: false,
    folderId: null,
    folderName: null,
    folderSlug: null,
  });
  const [count, setCount] = useState(followersCount);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingFolders = useRef(false);

  useEffect(() => {
    if (!user) return;
    bookmarkApi.getStatus(mangaId).then((s) => setStatus(s)).catch(() => {
      // Status fetch failed — keep default "not bookmarked" state
    });
  }, [user, mangaId]);

  const loadFolders = async () => {
    if (foldersLoaded || loadingFolders.current) return;
    loadingFolders.current = true;
    try {
      const data = await bookmarkApi.getFolders();
      setFolders(data);
      setFoldersLoaded(true);
    } catch {
      toast.error('Failed to load folders');
    } finally {
      loadingFolders.current = false;
    }
  };

  const handleSelect = async (folder: BookmarkFolder) => {
    if (!user) { router.push('/login'); return; }
    if (status.bookmarked && status.folderId === folder.id) return;
    setLoading(true);
    try {
      if (!status.bookmarked) {
        await bookmarkApi.addBookmark(mangaId, folder.id);
        setStatus({ bookmarked: true, folderId: folder.id, folderName: folder.name, folderSlug: folder.slug });
        setCount((c) => c + 1);
        toast.success(`Added to "${folder.name}"`);
      } else {
        await bookmarkApi.changeFolder(mangaId, folder.id);
        setStatus({ bookmarked: true, folderId: folder.id, folderName: folder.name, folderSlug: folder.slug });
        toast.success(`Moved to "${folder.name}"`);
      }
      // Invalidate homepage strip so next nav home shows this manga.
      mutate(SWR_KEYS.USER_BOOKMARK_STRIP);
      // Flip flag locally — no refetch. Server stays source of truth on next /auth/me revalidate.
      mutate(
        SWR_KEYS.AUTH_ME,
        (u: AuthUser | undefined) => (u ? { ...u, hasBookmark: true } : u),
        false,
      );
    } catch {
      toast.error('Failed to update bookmark');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await bookmarkApi.removeBookmark(mangaId);
      setStatus({ bookmarked: false, folderId: null, folderName: null, folderSlug: null });
      setCount((c) => Math.max(0, c - 1));
      toast.success('Removed from bookmarks');
      // Invalidate homepage strip — unbookmarking removes from Follow List. We don't
      // flip hasBookmark=false because this may not be the user's last bookmark;
      // SWR's revalidateOnFocus will pull the canonical value from /auth/me.
      mutate(SWR_KEYS.USER_BOOKMARK_STRIP);
    } catch {
      toast.error('Failed to remove bookmark');
    } finally {
      setLoading(false);
    }
  };

  const defaultFolders = folders.filter((f) => f.isDefault);
  const customFolders = folders.filter((f) => !f.isDefault);

  const triggerLabel = status.bookmarked ? (status.folderName ?? 'Following') : 'Follow';

  if (!user) {
    return (
      <Button
        variant="secondary"
        onClick={() => router.push('/login')}
        className="font-rajdhani font-bold tracking-wide"
      >
        <BookmarkSimpleIcon size={16} weight="regular" />
        Follow ({count})
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          disabled={loading}
          className={`font-rajdhani font-bold tracking-wide ${status.bookmarked ? 'border-accent/40 text-accent' : ''}`}
          onPointerDown={() => loadFolders()}
        >
          {loading
            ? <SpinnerIcon size={16} className="animate-spin" />
            : <BookmarkSimpleIcon size={16} weight={status.bookmarked ? 'fill' : 'regular'} />
          }
          {triggerLabel} ({count})
          <CaretDownIcon size={12} className="text-secondary" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" style={{ minWidth: 'var(--radix-dropdown-menu-trigger-width)' }}>
        {!foldersLoaded ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-secondary">
              <SpinnerIcon size={14} className="animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {defaultFolders.length > 0 && (
                <>
                  <DropdownMenuLabel>Default</DropdownMenuLabel>
                  {defaultFolders.map((folder) => (
                    <DropdownMenuItem key={folder.id} onClick={() => handleSelect(folder)}>
                      <CheckIcon
                        size={14}
                        className={status.folderId === folder.id ? 'text-accent' : 'opacity-0'}
                      />
                      {folder.name}
                      <span className="ml-auto text-xs text-secondary">{folder.count}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {customFolders.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Custom</DropdownMenuLabel>
                  {customFolders.map((folder) => (
                    <DropdownMenuItem key={folder.id} onClick={() => handleSelect(folder)}>
                      <CheckIcon
                        size={14}
                        className={status.folderId === folder.id ? 'text-accent' : 'opacity-0'}
                      />
                      {folder.name}
                      <span className="ml-auto text-xs text-secondary">{folder.count}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {status.bookmarked && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleRemove}
                    className="text-red-400 hover:text-red-300 focus:text-red-300"
                  >
                    <TrashIcon size={14} />
                    Remove
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
