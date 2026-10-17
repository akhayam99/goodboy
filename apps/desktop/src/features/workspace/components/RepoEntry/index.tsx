import { AlertTriangle, GitBranch } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { AnchoredPopover, Button, StatusDot, Tooltip, cn, useDropdown } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { workspaceReposOf } from '../../../../store/slices/repo-divergence/workspaceReposOf';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useRepoDivergenceCheck } from '../../hooks/useRepoDivergenceCheck';
import { RepoEntryPanel } from './RepoEntryPanel';
import { repoEntryFactsOf } from './repoEntryFactsOf';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const RepoEntry = ({ workspaceId }: Props) => {
  useRepoDivergenceCheck({ workspaceId });
  const projects = useAppStore(
    useShallow((state) => workspaceReposOf({ projects: state.projects, workspaceId })),
  );
  const reports = useAppStore(
    useShallow((state) => projects.map((project) => state.repoDivergence[project.id])),
  );
  const dropdown = useDropdown({
    width: 'w-96',
    expectedWidth: 384,
    expectedHeight: 420,
  });
  if (projects.length === 0) {
    return null;
  }
  const entries = projects.map((project, index) => ({ project, report: reports[index] }));
  const facts = repoEntryFactsOf({ entries });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Repositories"
      className="flex w-96 max-h-[min(32rem,calc(100vh-2rem))] flex-col"
      trigger={
        <Tooltip content={facts.tooltip} isSuppressed={dropdown.open}>
          <Button
            variant="quiet"
            size="sm"
            data-tauri-drag-region="false"
            data-repo-entry={facts.dot ?? (facts.isFailed ? 'failed' : 'quiet')}
            aria-label={facts.label === null ? 'Repositories' : `Repositories: ${facts.label}`}
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={dropdown.toggle}
            className={cn(
              'shrink-0 px-2',
              facts.label === null || facts.isFailed ? 'text-muted-foreground' : 'text-foreground',
              dropdown.open && 'bg-selected text-foreground',
            )}
          >
            {facts.isFailed ? (
              <AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            ) : (
              <GitBranch size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            )}
            {facts.label === null ? null : <span className="truncate">{facts.label}</span>}
            {facts.dot === null ? null : <StatusDot tone={facts.dot} size="sm" />}
          </Button>
        </Tooltip>
      }
    >
      <RepoEntryPanel workspaceId={workspaceId} entries={entries} failedCount={facts.failedCount} />
    </AnchoredPopover>
  );
};
