'use client';

import { useState, useRef } from 'react';
import { UploadSimple, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import type { ImportPreviewEntry, ImportResult } from '@/types/bookmark.types';

type Stage = 'idle' | 'previewing' | 'preview' | 'importing' | 'done';

const FORMAT_OPTIONS = [
  { value: 'mal-xml', label: 'MAL XML' },
  { value: 'mal-json', label: 'MAL JSON' },
];

const STRATEGY_OPTIONS = [
  { value: 'skip', label: 'Skip existing' },
  { value: 'overwrite', label: 'Overwrite existing' },
];

export function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState('mal-xml');
  const [strategy, setStrategy] = useState('skip');
  const [stage, setStage] = useState<Stage>('idle');
  const [preview, setPreview] = useState<ImportPreviewEntry[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setStage('idle');
    setPreview(null);
    setResult(null);
  }

  async function handlePreview() {
    if (!file) return;
    setStage('previewing');
    try {
      const data = await bookmarkApi.importPreview(file, format);
      setPreview(data?.entries ?? data ?? []);
      setStage('preview');
    } catch {
      toast.error('Preview failed. Check file format.');
      setStage('idle');
    }
  }

  async function handleImport() {
    if (!file) return;
    setStage('importing');
    try {
      const data = await bookmarkApi.importBookmarks(file, format, strategy);
      setResult(data);
      setStage('done');
      toast.success('Import complete');
    } catch {
      toast.error('Import failed');
      setStage('preview');
    }
  }

  function handleReset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStage('idle');
    if (fileRef.current) fileRef.current.value = '';
  }

  const matchedCount = preview?.filter((e) => e.matchedManga != null).length ?? 0;
  const totalCount = preview?.length ?? 0;

  return (
    <div className="space-y-5">
      {/* File picker */}
      <div>
        <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wider">File</p>
        <label className="flex items-center gap-3 px-4 py-3 bg-surface border border-default rounded-md cursor-pointer hover:bg-hover transition-colors">
          <UploadSimple size={18} className="text-muted shrink-0" />
          <span className="text-sm text-secondary truncate">
            {file ? file.name : 'Choose a file (.xml or .json)'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".xml,.json"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>
      </div>

      {/* Format + Strategy */}
      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wider">Format</p>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wider">Strategy</p>
          <Select value={strategy} onValueChange={setStrategy}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview result */}
      {stage === 'preview' && preview && (
        <div className="bg-surface border border-default rounded-md p-4 space-y-2">
          <p className="text-sm font-semibold text-primary">Preview</p>
          <p className="text-sm text-secondary">
            Found <span className="text-accent font-semibold">{matchedCount}</span> / {totalCount} entries matched.
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {preview.slice(0, 50).map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {e.matchedManga ? (
                  <CheckCircle size={14} className="text-success shrink-0" />
                ) : (
                  <WarningCircle size={14} className="text-warning shrink-0" />
                )}
                <span className="text-secondary truncate">{e.title}</span>
                {e.matchedManga && (
                  <span className="text-muted shrink-0">→ {e.matchedManga.title}</span>
                )}
              </div>
            ))}
            {preview.length > 50 && (
              <p className="text-xs text-muted pt-1">...and {preview.length - 50} more</p>
            )}
          </div>
        </div>
      )}

      {/* Done result */}
      {stage === 'done' && result && (
        <div className="bg-surface border border-default rounded-md p-4 space-y-1">
          <p className="text-sm font-semibold text-primary mb-2">Import Result</p>
          <p className="text-sm text-secondary">Imported: <span className="text-accent font-semibold">{result.imported}</span></p>
          <p className="text-sm text-secondary">Skipped: <span className="text-warning font-semibold">{result.skipped}</span></p>
          <p className="text-sm text-secondary">Not found: <span className="text-muted font-semibold">{result.notFound}</span></p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {stage !== 'done' && (
          <Button
            variant="secondary"
            onClick={handlePreview}
            disabled={!file || stage === 'previewing' || stage === 'importing'}
          >
            {stage === 'previewing' ? 'Loading...' : 'Preview'}
          </Button>
        )}
        {(stage === 'preview' || stage === 'importing') && (
          <Button
            onClick={handleImport}
            disabled={stage === 'importing'}
          >
            {stage === 'importing' ? 'Importing...' : `Import ${matchedCount} items`}
          </Button>
        )}
        {(stage === 'done' || stage === 'preview') && (
          <Button variant="ghost" onClick={handleReset}>
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
