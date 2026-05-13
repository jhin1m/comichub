'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DotsThreeOutlineIcon } from '@phosphor-icons/react';
import { adminCommentReportsApi, type AdminCommentReportRow } from '@/lib/api/comment.api';
import { Pagination } from '@/components/ui/pagination';
import { adminReportsKey } from '@/lib/swr/swr-keys';
import { cn, formatRelativeDate } from '@/lib/utils';

const LIMIT = 20;

type StatusFilter = 'pending' | 'resolved' | 'dismissed';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam / Advertising',
  harassment: 'Harassment / Abuse',
  hate_speech: 'Hate speech',
  sexual_content: 'Sexual content',
  spoiler: 'Spoiler',
  misinformation: 'Misinformation',
  other: 'Other',
};

interface PaginatedReports {
  data: AdminCommentReportRow[];
  total: number;
  page: number;
  limit: number;
}

export function ReportsTable() {
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [page, setPage] = useState(1);

  const swrKey = adminReportsKey(page, status);

  const { data, isLoading, mutate } = useSWR<PaginatedReports>(
    swrKey,
    () => adminCommentReportsApi.list({ page, limit: LIMIT, status }),
    { onError: () => toast.error('Could not load reports') },
  );

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const handleStatusChange = (s: StatusFilter) => {
    setStatus(s);
    setPage(1);
  };

  const handleAction = async (
    report: AdminCommentReportRow,
    action: 'dismiss' | 'delete_comment' | 'warn_user',
  ) => {
    // Optimistic remove
    await mutate(
      async (current?: PaginatedReports) => {
        await adminCommentReportsApi.resolve(report.id, action);
        if (!current) return current;
        return {
          ...current,
          data: current.data.filter((r) => r.id !== report.id),
          total: Math.max(0, current.total - 1),
        };
      },
      {
        optimisticData: (current?: PaginatedReports) =>
          current
            ? { ...current, data: current.data.filter((r) => r.id !== report.id), total: Math.max(0, current.total - 1) }
            : current!,
        rollbackOnError: true,
        revalidate: false,
        populateCache: true,
      },
    );

    const actionLabels: Record<string, string> = {
      dismiss: 'Report dismissed',
      delete_comment: 'Comment deleted',
      warn_user: 'User warned',
    };
    toast.success(actionLabels[action] ?? 'Done');
  };

  return (
    <div>
      {/* Status filter tabs */}
      <div className="flex items-center bg-surface/60 rounded-lg p-0.5 w-fit mb-5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium transition-all',
              status === tab.value
                ? 'bg-elevated text-primary shadow-sm'
                : 'text-muted hover:text-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-default overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-elevated text-left">
              <th className="px-4 py-3 text-muted font-medium">Comment</th>
              <th className="px-4 py-3 text-muted font-medium">Reporter</th>
              <th className="px-4 py-3 text-muted font-medium">Reason</th>
              <th className="px-4 py-3 text-muted font-medium">Time</th>
              <th className="px-4 py-3 text-muted font-medium">Status</th>
              <th className="px-4 py-3 text-muted font-medium w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {isLoading && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-elevated rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            )}

            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No reports.
                </td>
              </tr>
            )}

            {!isLoading && rows.map((report) => (
              <tr key={report.id} className="hover:bg-hover/40 transition-colors">
                <td className="px-4 py-3 max-w-[200px]">
                  <p className={cn('truncate text-primary', report.commentDeletedAt && 'line-through text-muted')}>
                    {report.commentContent
                      ? report.commentContent.replace(/<[^>]*>/g, '').slice(0, 100)
                      : <span className="text-muted italic">Deleted</span>
                    }
                  </p>
                  <span className="text-muted text-[10px]">#{report.commentId}</span>
                </td>
                <td className="px-4 py-3 text-secondary whitespace-nowrap">
                  {report.reporterName ?? `#${report.reporterId}`}
                </td>
                <td className="px-4 py-3 text-secondary">
                  {REASON_LABELS[report.reason] ?? report.reason}
                </td>
                <td className="px-4 py-3 text-muted whitespace-nowrap">
                  {formatRelativeDate(report.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-medium',
                    report.status === 'pending' && 'bg-warning/20 text-warning',
                    report.status === 'resolved' && 'bg-success/20 text-success',
                    report.status === 'dismissed' && 'bg-muted/20 text-muted',
                  )}>
                    {report.status === 'pending' ? 'Pending'
                      : report.status === 'resolved' ? 'Resolved'
                      : 'Dismissed'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        aria-label="Actions"
                        className="p-1 text-muted hover:text-primary transition-colors rounded"
                      >
                        <DotsThreeOutlineIcon size={14} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="bg-elevated border border-default rounded-md shadow-lg py-1 z-50 min-w-[150px] animate-in fade-in-0 zoom-in-95"
                        sideOffset={4}
                        align="end"
                      >
                        <DropdownMenu.Item
                          onClick={() => handleAction(report, 'dismiss')}
                          className="px-3 py-1.5 text-xs text-secondary hover:bg-hover hover:text-primary transition-colors cursor-pointer outline-none"
                        >
                          Dismiss report
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onClick={() => handleAction(report, 'delete_comment')}
                          className="px-3 py-1.5 text-xs text-accent hover:bg-hover transition-colors cursor-pointer outline-none"
                        >
                          Delete comment
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onClick={() => handleAction(report, 'warn_user')}
                          className="px-3 py-1.5 text-xs text-warning hover:bg-hover transition-colors cursor-pointer outline-none"
                        >
                          Warn user
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
