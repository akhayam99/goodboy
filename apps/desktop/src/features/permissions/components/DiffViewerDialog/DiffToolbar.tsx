import { Check, GitBranch, PanelLeftClose, PanelLeftOpen, RefreshCw, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { WorktreeStatus } from '@goodboy/types';
import { TOOLBAR_ICON_BTN } from './lib';

type Props = {
  title?: string;
  prNumber?: number;
  openCommentsCount: number;
  reviewedCount: number | null;
  filesCount: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  status: WorktreeStatus | null;
  onRefresh?: () => void;
  refreshing: boolean;
  showClose: boolean;
  onClose: () => void;
  viewSelector?: React.ReactNode;
};

export const DiffToolbar = ({
  title,
  prNumber,
  openCommentsCount,
  reviewedCount,
  filesCount,
  sidebarCollapsed,
  onToggleSidebar,
  status,
  onRefresh,
  refreshing,
  showClose,
  onClose,
  viewSelector,
}: Props) => {
  const titleText = title ?? (prNumber !== undefined ? `pr #${prNumber} diff` : 'diff');
  const aheadBehind =
    status?.hasUpstream && (status.ahead > 0 || status.behind > 0)
      ? `↑${status.ahead} ↓${status.behind}`
      : null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border-soft px-2.5 py-1.5">
      <button
        type="button"
        onClick={onToggleSidebar}
        className={TOOLBAR_ICON_BTN}
        title={sidebarCollapsed ? 'show file list' : 'hide file list'}
        aria-label={sidebarCollapsed ? 'show file list' : 'hide file list'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {viewSelector ?? (
          <span className="shrink-0 text-xs font-semibold tracking-tight text-foreground">
            {titleText}
          </span>
        )}
        {openCommentsCount > 0 ? (
          <span
            className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning"
            title={`${openCommentsCount} open ${openCommentsCount === 1 ? 'note' : 'notes'}`}
          >
            {openCommentsCount} {openCommentsCount === 1 ? 'note' : 'notes'}
          </span>
        ) : null}
        {reviewedCount !== null && filesCount > 0 ? (
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              reviewedCount === filesCount
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground',
            )}
            title={`${reviewedCount} of ${filesCount} files reviewed`}
          >
            <Check size={9} aria-hidden />
            {reviewedCount}/{filesCount} reviewed
          </span>
        ) : null}
      </div>

      {status?.branch ? (
        <span className="hidden min-w-0 shrink items-center gap-1.5 text-2xs text-muted-foreground md:flex">
          <GitBranch size={11} aria-hidden className="shrink-0 text-muted-foreground/70" />
          <span className="truncate font-mono">{status.branch}</span>
          {aheadBehind ? <span className="shrink-0 tabular-nums">{aheadBehind}</span> : null}
        </span>
      ) : null}

      <div className="flex shrink-0 items-center gap-0.5">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="refresh git state"
            aria-label="refresh git state"
            className={cn(TOOLBAR_ICON_BTN, 'disabled:opacity-50')}
          >
            <RefreshCw
              size={12}
              className={refreshing ? 'motion-safe:animate-spin' : undefined}
              aria-hidden
            />
          </button>
        ) : null}
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            title="close"
            aria-label="close"
            className={TOOLBAR_ICON_BTN}
          >
            <X size={13} />
          </button>
        ) : null}
      </div>
    </div>
  );
};
