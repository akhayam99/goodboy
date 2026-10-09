import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUpDown,
  Check,
  CheckCheck,
  ChevronLeft,
  Circle,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import {
  ROW_INTERACTIVE,
  AnchoredPopover,
  Button,
  IconButton,
  PopoverBody,
  cn,
  useDropdown,
} from '@goodboy/ui';
import type { ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import type { ProjectGitStatusEntry } from '../../hooks/useProjectGitStatuses';
import { ProjectGitDetail } from './ProjectGitDetail';
import {
  projectGitPresentationOf,
  projectGitRowStatusOf,
  type ProjectGitRowStatus,
} from '../../../../shared/lib/projectGitPresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly entries: ReadonlyArray<ProjectGitStatusEntry>;
  readonly isQuiet?: boolean;
};

type SummaryEntry = ProjectGitStatusEntry & {
  readonly actionableCount: number;
  readonly uncommittedCount: number;
  readonly branch: string;
  readonly isWarning: boolean;
  readonly rowStatus: ProjectGitRowStatus | null;
};

type RowGlyphParams = {
  readonly kind: ProjectGitRowStatus['kind'];
};

const rowTierOf = (entry: SummaryEntry): number => {
  if (entry.rowStatus?.kind === 'behind') {
    return 0;
  }
  if (entry.rowStatus?.kind === 'up-to-date') {
    return 2;
  }
  if (entry.rowStatus == null && !entry.isWarning) {
    return 2;
  }
  return 1;
};

const rowGlyphOf = ({ kind }: RowGlyphParams) => {
  switch (kind) {
    case 'behind':
      return <ArrowDown size={ICON_SIZE.mark} aria-hidden className="text-info" />;
    case 'up-to-date':
      return <Check size={ICON_SIZE.mark} aria-hidden className="text-faint-foreground" />;
    case 'uncommitted':
      return <Circle size={ICON_SIZE.mark} aria-hidden className="fill-current text-warning" />;
    case 'diverged':
      return <ArrowUpDown size={ICON_SIZE.mark} aria-hidden className="text-warning" />;
    case 'rebase-stopped':
      return <AlertTriangle size={ICON_SIZE.mark} aria-hidden className="text-warning" />;
    case 'cant-read':
      return <AlertTriangle size={ICON_SIZE.mark} aria-hidden className="text-danger" />;
    case 'no-upstream':
    case 'detached':
      return null;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

const rowToneClass = (kind: ProjectGitRowStatus['kind']): string => {
  switch (kind) {
    case 'behind':
      return 'text-info';
    case 'up-to-date':
      return 'text-faint-foreground';
    case 'uncommitted':
    case 'diverged':
    case 'rebase-stopped':
      return 'text-warning';
    case 'cant-read':
      return 'text-danger';
    case 'no-upstream':
    case 'detached':
      return 'text-muted-foreground';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

const summaryPhraseOf = (entries: ReadonlyArray<SummaryEntry>): string | null => {
  const countOf = (kind: ProjectGitRowStatus['kind']) =>
    entries.filter((entry) => entry.rowStatus?.kind === kind).length;
  const parts = [
    { count: countOf('behind'), label: 'behind' },
    { count: countOf('uncommitted'), label: 'uncommitted' },
    { count: countOf('diverged'), label: 'diverged' },
  ]
    .filter((part) => part.count > 0)
    .map((part) => `${part.count} ${part.label}`);
  return parts.length === 0 ? null : parts.join(' · ');
};

export const ProjectGitSummaryPill = ({ entries, isQuiet = false }: Props) => {
  const dropdown = useDropdown({
    width: 'w-80',
    expectedWidth: 320,
    expectedHeight: 420,
    align: 'end',
  });
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectId | null>(null);
  const [isCheckingOrigin, setIsCheckingOrigin] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const fetchProjectCheckouts = useAppStore((state) => state.fetchProjectCheckouts);
  const fastForwardProjectCheckouts = useAppStore((state) => state.fastForwardProjectCheckouts);
  const checkoutResults = useAppStore((state) => state.projectCheckoutResult);
  const { showToast } = useToast();
  const hasOpenedRef = useRef(false);
  const workspaceId = entries[0]?.project.workspaceId ?? null;

  useEffect(() => {
    if (!dropdown.open || workspaceId === null || hasOpenedRef.current) {
      return;
    }
    hasOpenedRef.current = true;
    setIsCheckingOrigin(true);
    void fetchProjectCheckouts({ workspaceId }).finally(() => setIsCheckingOrigin(false));
  }, [dropdown.open, fetchProjectCheckouts, workspaceId]);

  useEffect(() => {
    if (!dropdown.open) {
      hasOpenedRef.current = false;
    }
  }, [dropdown.open]);

  const summaryEntries = useMemo<ReadonlyArray<SummaryEntry>>(
    () =>
      entries
        .map((entry) => ({
          ...entry,
          ...projectGitPresentationOf({ status: entry.status }),
          rowStatus:
            entry.status?.state === 'ready'
              ? projectGitRowStatusOf({ status: entry.status })
              : null,
        }))
        .sort((left, right) => {
          const tierDelta = rowTierOf(left) - rowTierOf(right);
          if (tierDelta !== 0) {
            return tierDelta;
          }
          return left.project.name.localeCompare(right.project.name);
        }),
    [entries],
  );
  const selectedEntry =
    summaryEntries.find((entry) => entry.project.id === selectedProjectId) ?? null;
  const hasWarning = summaryEntries.some((entry) => entry.isWarning);
  const actionableCount = summaryEntries.reduce((total, entry) => total + entry.actionableCount, 0);
  const uncommittedCount = summaryEntries.reduce(
    (total, entry) => total + entry.uncommittedCount,
    0,
  );
  const updatableProjects = summaryEntries.filter((entry) => entry.rowStatus?.updatable === true);
  const summaryPhrase = summaryPhraseOf(summaryEntries);
  const updatingCount = updatableProjects.filter(
    (entry) => checkoutResults[entry.project.id]?.kind === 'updating',
  ).length;

  const onCheckOrigin = async () => {
    if (workspaceId === null || isCheckingOrigin) {
      return;
    }
    setIsCheckingOrigin(true);
    try {
      await fetchProjectCheckouts({ workspaceId });
    } finally {
      setIsCheckingOrigin(false);
    }
  };

  const onUpdateAll = async () => {
    if (workspaceId === null || isUpdating || updatableProjects.length === 0) {
      return;
    }
    setIsUpdating(true);
    try {
      const { updated, failed } = await fastForwardProjectCheckouts({ workspaceId });
      showToast({
        kind: failed > 0 ? 'info' : 'success',
        title: 'Repositories updated',
        message:
          failed === 0
            ? `Updated ${updated} ${updated === 1 ? 'repo' : 'repos'}`
            : `Updated ${updated} ${updated === 1 ? 'repo' : 'repos'} · ${failed} failed`,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Repository git statuses"
      className="flex w-80 max-h-[min(32rem,calc(100vh-2rem))] flex-col"
      trigger={
        <button
          type="button"
          aria-label={`${entries.length} repository git statuses`}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn(
            'relative inline-flex min-w-0 items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            isQuiet
              ? 'h-6 gap-1 px-1 text-meta text-muted-foreground hover:text-foreground'
              : 'h-7 gap-2 px-2 text-label font-medium',
            !isQuiet &&
              (actionableCount > 0 || hasWarning
                ? 'text-foreground hover:bg-hover'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground'),
          )}
        >
          <GitBranch size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span>{entries.length} repos</span>
          {hasWarning ? (
            <span
              data-testid="project-git-summary-warning"
              className="flex items-center text-warning"
            >
              <AlertTriangle size={ICON_SIZE.mark} aria-hidden />
            </span>
          ) : uncommittedCount > 0 ? (
            <span
              data-testid="project-git-summary-count"
              className={cn(
                'shrink-0 text-meta tabular-nums',
                isQuiet ? 'text-muted-foreground' : 'text-warning',
              )}
            >
              {uncommittedCount} uncommitted
            </span>
          ) : null}
        </button>
      }
    >
      {selectedEntry == null ? (
        <>
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-soft px-3">
            <div className="min-w-0 flex-1">
              <div className="text-label text-foreground">{entries.length} repos</div>
              {summaryPhrase != null ? (
                <div className="truncate text-meta text-muted-foreground">{summaryPhrase}</div>
              ) : null}
            </div>
            <IconButton
              variant="ghost"
              icon={RefreshCw}
              iconSize={ICON_SIZE.row}
              label="Check origin"
              tooltip="Check origin"
              onClick={() => void onCheckOrigin()}
              className={cn('shrink-0', isCheckingOrigin && 'spin-border spin-border-info')}
            />
            {updatableProjects.length === 0 ? (
              <span className="flex shrink-0 items-center gap-1 text-label text-muted-foreground">
                <CheckCheck size={ICON_SIZE.row} aria-hidden />
                All up to date
              </span>
            ) : (
              <Button
                size="sm"
                variant="primary"
                disabled={isUpdating}
                onClick={() => void onUpdateAll()}
              >
                {isUpdating
                  ? `Updating ${updatingCount} of ${updatableProjects.length}`
                  : `Update ${updatableProjects.length}`}
              </Button>
            )}
          </div>
          <PopoverBody>
            {summaryEntries.map((entry) => {
              const result = checkoutResults[entry.project.id];
              return (
                <button
                  key={entry.project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(entry.project.id)}
                  className={cn(
                    'flex h-9 w-full items-center gap-2 px-3 text-left transition-colors',
                    ROW_INTERACTIVE,
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-label font-medium">
                    {entry.project.name}
                  </span>
                  <span className="shrink-0 font-mono text-meta text-muted-foreground">
                    {entry.branch}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 justify-end text-meta">
                    {result?.kind === 'updating' ? (
                      <span className="text-muted-foreground">Updating…</span>
                    ) : result?.kind === 'updated' ? (
                      <span className="flex items-center gap-1 text-success">
                        <Check size={ICON_SIZE.mark} aria-hidden />
                        {`Updated · ${result.commits} ${result.commits === 1 ? 'commit' : 'commits'}`}
                      </span>
                    ) : result?.kind === 'failed' ? (
                      <span className="text-danger">Failed</span>
                    ) : entry.rowStatus != null ? (
                      <span
                        className={cn(
                          'flex items-center gap-1',
                          rowToneClass(entry.rowStatus.kind),
                        )}
                      >
                        {rowGlyphOf({ kind: entry.rowStatus.kind })}
                        {entry.rowStatus.label}
                      </span>
                    ) : entry.isWarning ? (
                      <AlertTriangle
                        size={ICON_SIZE.mark}
                        aria-label="Warning"
                        className="text-warning"
                      />
                    ) : entry.uncommittedCount > 0 ? (
                      <span className="tabular-nums text-warning">
                        {entry.uncommittedCount} uncommitted
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </PopoverBody>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSelectedProjectId(null)}
            className="flex h-9 shrink-0 items-center gap-2 border-b border-border-soft px-3 text-label font-medium transition-colors hover:bg-hover"
          >
            <ChevronLeft size={ICON_SIZE.row} aria-hidden />
            <span className="truncate">{selectedEntry.project.name}</span>
          </button>
          <PopoverBody>
            <ProjectGitDetail project={selectedEntry.project} status={selectedEntry.status} />
          </PopoverBody>
        </>
      )}
    </AnchoredPopover>
  );
};
