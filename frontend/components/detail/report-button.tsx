'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { mangaApi } from '@/lib/api/manga.api';
import { useAuth } from '@/contexts/auth.context';

interface Props {
  mangaId: number;
  firstChapterId?: number;
}

const REPORT_TYPES = [
  { value: 'broken_images', label: 'Broken Images' },
  { value: 'wrong_chapter', label: 'Wrong Chapter' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Other' },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]['value'];

export function ReportButton({ mangaId: _mangaId, firstChapterId }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType>('broken_images');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next && !user) {
      window.location.assign('/login');
      return;
    }
    if (!next && loading) return;
    setOpen(next);
    if (!next) {
      setType('broken_images');
      setDescription('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstChapterId) {
      toast.error('No chapter available to report.');
      return;
    }
    setLoading(true);
    try {
      await mangaApi.reportChapter(firstChapterId, type, description || undefined);
      toast.success('Report submitted');
      setOpen(false);
      setType('broken_images');
      setDescription('');
    } catch {
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          title="Report"
          aria-label="Report"
          className="flex items-center justify-center w-8 h-8 rounded text-muted hover:text-primary hover:bg-elevated transition-colors"
        >
          <AlertTriangle size={16} />
        </button>
      </DialogTrigger>

      <DialogContent>
        <div className="flex items-center justify-between mb-5">
          <DialogTitle>Report Issue</DialogTitle>
          <DialogClose asChild>
            <button
              className="text-muted hover:text-primary transition-colors"
              aria-label="Close"
              disabled={loading}
            >
              <X size={18} />
            </button>
          </DialogClose>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-secondary mb-1.5">
                Report Type <span className="text-red-400">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ReportType)}
                required
                className="w-full bg-elevated border border-default text-primary rounded px-3 py-2 text-sm focus:outline-none focus:border-hover"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-secondary mb-1.5">
                Description <span className="text-muted">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the issue..."
                maxLength={500}
                className="w-full bg-elevated border border-default text-primary rounded px-3 py-2 text-sm focus:outline-none focus:border-hover resize-none placeholder:text-muted"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  );
}
