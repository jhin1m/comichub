'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { PixelButton } from '@pxlkit/ui-kit';
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = () => {
    if (!user) {
      window.location.assign('/login');
      return;
    }
    setOpen(true);
    setSuccess(false);
    setError('');
  };

  const handleClose = () => {
    if (loading) return;
    setOpen(false);
    setType('broken_images');
    setDescription('');
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstChapterId) {
      setError('No chapter available to report.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await mangaApi.reportChapter(firstChapterId, type, description || undefined);
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setType('broken_images');
        setDescription('');
      }, 1500);
    } catch {
      setError('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        title="Report"
        aria-label="Report"
        className="flex items-center justify-center w-8 h-8 rounded text-[#707070] hover:text-[#f5f5f5] hover:bg-[#252525] transition-colors"
      >
        <AlertTriangle size={16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-dialog-title"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 id="report-dialog-title" className="text-[#f5f5f5] font-semibold text-lg font-['Rajdhani',sans-serif]">
                Report Issue
              </h2>
              <button
                onClick={handleClose}
                className="text-[#707070] hover:text-[#f5f5f5] transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {success ? (
              <div className="text-center py-6 text-[#a0a0a0]">
                <AlertTriangle size={32} className="mx-auto mb-3 text-yellow-500" />
                <p className="text-[#f5f5f5] font-medium">Report submitted!</p>
                <p className="text-sm mt-1">Thank you for your feedback.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-[#a0a0a0] mb-1.5">
                    Report Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as ReportType)}
                    required
                    className="w-full bg-[#252525] border border-[#2a2a2a] text-[#f5f5f5] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#404040]"
                  >
                    {REPORT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[#a0a0a0] mb-1.5">
                    Description <span className="text-[#707070]">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe the issue..."
                    maxLength={500}
                    className="w-full bg-[#252525] border border-[#2a2a2a] text-[#f5f5f5] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#404040] resize-none placeholder:text-[#707070]"
                  />
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <PixelButton type="button" tone="neutral" onClick={handleClose} disabled={loading}>
                    Cancel
                  </PixelButton>
                  <PixelButton type="submit" tone="red" disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Report'}
                  </PixelButton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
