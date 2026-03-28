'use client';

import { useState } from 'react';
import { PencilSimple, Trash, Plus, Check, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import { Button } from '@/components/ui/button';
import type { BookmarkFolder } from '@/types/bookmark.types';

interface FolderManagerTabProps {
  folders: BookmarkFolder[];
  onFoldersChanged: () => void;
}

export function FolderManagerTab({ folders, onFoldersChanged }: FolderManagerTabProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate() {
    const name = newFolderName.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      await bookmarkApi.createFolder(name);
      toast.success('Folder created');
      setNewFolderName('');
      setShowNewInput(false);
      onFoldersChanged();
    } catch {
      toast.error('Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate(id: number) {
    const name = editName.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      await bookmarkApi.updateFolder(id, { name });
      toast.success('Folder renamed');
      setEditingId(null);
      onFoldersChanged();
    } catch {
      toast.error('Failed to rename folder');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Delete folder "${name}"? Bookmarks will be moved to the default folder.`)) return;
    try {
      await bookmarkApi.deleteFolder(id);
      toast.success('Folder deleted');
      onFoldersChanged();
    } catch {
      toast.error('Failed to delete folder');
    }
  }

  function startEdit(folder: BookmarkFolder) {
    setEditingId(folder.id);
    setEditName(folder.name);
  }

  return (
    <div className="space-y-2">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="flex items-center gap-3 px-4 py-3 bg-surface border border-default rounded-md"
        >
          {editingId === folder.id ? (
            <>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdate(folder.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
                className="flex-1 h-8 bg-elevated border border-accent rounded px-2 text-sm text-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleUpdate(folder.id)}
                disabled={isSaving}
                className="p-1.5 text-accent hover:bg-hover rounded transition-colors disabled:opacity-40"
              >
                <Check size={15} />
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="p-1.5 text-muted hover:bg-hover rounded transition-colors"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-primary font-medium">{folder.name}</span>
              <span className="text-xs text-muted">{folder.count} manga</span>
              {folder.isDefault ? (
                <span className="text-xs text-muted italic">default</span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(folder)}
                    className="p-1.5 text-muted hover:text-secondary hover:bg-hover rounded transition-colors"
                    title="Rename"
                  >
                    <PencilSimple size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(folder.id, folder.name)}
                    className="p-1.5 text-muted hover:text-red-400 hover:bg-hover rounded transition-colors"
                    title="Delete"
                  >
                    <Trash size={15} />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      ))}

      {/* New folder input */}
      {showNewInput ? (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="text"
            placeholder="Folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setShowNewInput(false); setNewFolderName(''); }
            }}
            autoFocus
            className="flex-1 h-10 bg-elevated border border-default rounded-md px-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
          />
          <Button size="sm" onClick={handleCreate} disabled={isCreating || !newFolderName.trim()}>
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setShowNewInput(false); setNewFolderName(''); }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewInput(true)}
          className="flex items-center gap-2 px-4 py-3 w-full text-sm text-muted hover:text-primary hover:bg-hover border border-dashed border-default rounded-md transition-colors mt-3"
        >
          <Plus size={15} />
          New Folder
        </button>
      )}
    </div>
  );
}
