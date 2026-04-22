'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusIcon,
  BookmarkSimpleIcon,
  CheckIcon,
  TrashIcon,
  SpinnerIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
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
}

export function QuickBookmarkButton({ mangaId }: Props) {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const [status, setStatus] = useState<BookmarkStatus>({
    bookmarked: false,
    folderId: null,
    folderName: null,
    folderSlug: null,
  });
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingFolders = useRef(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    // Load status + folders in parallel on first open
    const promises: Promise<void>[] = [];
    if (!statusLoaded) {
      promises.push(
        bookmarkApi.getStatus(mangaId).then((s) => {
          setStatus(s);
          setStatusLoaded(true);
        }).catch(() => { setStatusLoaded(true); }),
      );
    }
    if (!foldersLoaded && !loadingFolders.current) {
      loadingFolders.current = true;
      promises.push(
        bookmarkApi.getFolders().then((data) => {
          setFolders(data);
          setFoldersLoaded(true);
        }).catch(() => {
          toast.error('Failed to load folders');
        }).finally(() => { loadingFolders.current = false; }),
      );
    }
    await Promise.all(promises);
  }, [user, mangaId, statusLoaded, foldersLoaded]);

  const handleSelect = async (folder: BookmarkFolder) => {
    if (!user) { router.push('/login'); return; }
    if (loading) return;
    if (status.bookmarked && status.folderId === folder.id) return;
    setLoading(true);
    try {
      if (!status.bookmarked) {
        await bookmarkApi.addBookmark(mangaId, folder.id);
        setStatus({ bookmarked: true, folderId: folder.id, folderName: folder.name, folderSlug: folder.slug });
        toast.success(`Added to "${folder.name}"`);
      } else {
        await bookmarkApi.changeFolder(mangaId, folder.id);
        setStatus({ bookmarked: true, folderId: folder.id, folderName: folder.name, folderSlug: folder.slug });
        toast.success(`Moved to "${folder.name}"`);
      }
      mutate(SWR_KEYS.USER_BOOKMARK_STRIP);
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
    if (!user || loading) return;
    setLoading(true);
    try {
      await bookmarkApi.removeBookmark(mangaId);
      setStatus({ bookmarked: false, folderId: null, folderName: null, folderSlug: null });
      toast.success('Removed from bookmarks');
      mutate(SWR_KEYS.USER_BOOKMARK_STRIP);
    } catch {
      toast.error('Failed to remove bookmark');
    } finally {
      setLoading(false);
    }
  };

  const defaultFolders = folders.filter((f) => f.isDefault);
  const customFolders = folders.filter((f) => !f.isDefault);

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) loadData(); }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={loading}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!user) { e.preventDefault(); router.push('/login'); }
          }}
          className={`
            absolute bottom-1.5 right-1.5 z-10
            flex items-center justify-center
            size-7 rounded-full
            backdrop-blur-sm
            transition-all duration-200 ease-out
            cursor-pointer
            ${status.bookmarked
              ? 'bg-accent/90 text-white shadow-md shadow-accent/25'
              : 'bg-black/60 text-white/90 hover:bg-accent/80 hover:text-white hover:shadow-md hover:shadow-accent/25 hover:scale-110'
            }
            /* Mobile: always visible. PC: hidden, show on card hover */
            opacity-100 md:opacity-0 md:group-hover:opacity-100
          `}
          aria-label="Quick bookmark"
        >
          {loading ? (
            <SpinnerIcon size={14} className="animate-spin" />
          ) : status.bookmarked ? (
            <BookmarkSimpleIcon size={14} weight="fill" />
          ) : (
            <PlusIcon size={14} weight="bold" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        className="min-w-[160px]"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
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
