'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { commentApi } from '@/lib/api/comment.api';
import type { CommentReportReason } from '@/types/comment.types';
import { cn } from '@/lib/utils';

const REPORT_REASONS: { value: CommentReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam / Advertising' },
  { value: 'harassment', label: 'Harassment / Abuse' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'sexual_content', label: 'Sexual content' },
  { value: 'spoiler', label: 'Spoiler' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'other', label: 'Other' },
];

const REASON_VALUES = REPORT_REASONS.map((r) => r.value) as [
  CommentReportReason,
  ...CommentReportReason[],
];

const MAX_DETAILS = 500;

const reportSchema = z.object({
  reason: z.enum(REASON_VALUES, { message: 'Pick a reason' }),
  details: z
    .string()
    .max(MAX_DETAILS, `Max ${MAX_DETAILS} characters`)
    .optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

interface ReportCommentModalProps {
  commentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportCommentModal({
  commentId,
  open,
  onOpenChange,
}: ReportCommentModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { details: '' },
  });

  const watchedReason = watch('reason');
  const watchedDetails = watch('details') ?? '';

  useEffect(() => {
    if (!open) reset({ details: '' });
  }, [open, reset]);

  const onSubmit = async (data: ReportFormValues) => {
    try {
      await commentApi.report(commentId, {
        reason: data.reason,
        details: data.details?.trim() || undefined,
      });
      toast.success('Report submitted. Thanks!');
      onOpenChange(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        toast.error('You have already reported this comment');
      } else if (status === 429) {
        toast.error('Too many reports. Try again later.');
      } else {
        toast.error('Could not submit report. Try again later.');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Report comment</DialogTitle>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
          <p className="text-secondary text-xs">Select a reason:</p>

          <div className="space-y-1.5">
            {REPORT_REASONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors',
                  watchedReason === opt.value
                    ? 'bg-accent-muted border border-accent/40'
                    : 'border border-default hover:bg-hover',
                )}
              >
                <input
                  type="radio"
                  value={opt.value}
                  className="accent-accent"
                  {...register('reason')}
                />
                <span className="text-primary text-xs">{opt.label}</span>
              </label>
            ))}
            {errors.reason && (
              <p className="text-accent text-[11px]">{errors.reason.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-secondary text-xs">
              Additional details (optional)
            </label>
            <textarea
              rows={3}
              maxLength={MAX_DETAILS}
              placeholder="Add more context if needed..."
              {...register('details')}
              className="w-full bg-elevated border border-default rounded-md px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
            {watchedDetails.length > 0 && (
              <p
                className={cn(
                  'text-[10px] text-right',
                  watchedDetails.length >= MAX_DETAILS
                    ? 'text-accent'
                    : 'text-muted',
                )}
              >
                {watchedDetails.length}/{MAX_DETAILS}
              </p>
            )}
            {errors.details && (
              <p className="text-accent text-[11px]">
                {errors.details.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-1.5 rounded text-xs text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              {isSubmitting ? '...' : 'Submit report'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
