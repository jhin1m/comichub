'use client';

import { useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import type { BookmarkFolder } from '@/types/bookmark.types';

interface ExportTabProps {
  folders: BookmarkFolder[];
}

export function ExportTab({ folders }: ExportTabProps) {
  const [format, setFormat] = useState<'json' | 'xml'>('json');
  const [folderId, setFolderId] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const blob = await bookmarkApi.exportBookmarks(
        format,
        folderId !== 'all' ? Number(folderId) : undefined,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmarks-export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Format */}
      <div>
        <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wider">Format</p>
        <Select value={format} onValueChange={(v) => setFormat(v as 'json' | 'xml')}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="xml">XML</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Folder filter */}
      <div>
        <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wider">Folder</p>
        <Select value={folderId} onValueChange={setFolderId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Folders</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>
                {f.name} ({f.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleExport} disabled={isExporting}>
        <DownloadSimple size={16} />
        {isExporting ? 'Exporting...' : 'Download'}
      </Button>
    </div>
  );
}
