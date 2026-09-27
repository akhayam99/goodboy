import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GitBranch,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { AnchoredPopover, Tooltip, cn, formatError, useDropdown } from '@goodboy/ui';
import type { MountId, ProjectId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { distanceAhead } from '../../../../../shared/lib/gitStatus';
import { mainPresenceOf, type MainPresence } from '../../../../../shared/lib/branchPresence';
import { BaseBranchSelect } from '../../../../worktree/BaseBranchSelect';
import { useRebaseBranch } from '../../../hooks/useRebaseBranch';
import { usePushBranch } from '../../../hooks/usePushBranch';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type MainPresenceGlyphParams = {
  readonly kind: MainPresence['kind'];
};

const mainPresenceGlyphOf = ({ kind }: MainPresenceGlyphParams) => {
  switch (kind) {
    case 'behind-main':
      return <ArrowDown size={11} aria-hidden className="text-info" />;
    case 'rebasing-on-main':
      return (
        <RefreshCw size={11} aria-hidden className="text-info motion-safe:animate-soft-pulse" />
      );
    case 'rebase-stopped':
      return <AlertTriangle size={11} aria-hidden className="text-warning" />;
    case 'up-to-date':
      return null;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

const mainPresenceToneClass = (kind: MainPresence['kind']): string => {
  switch (kind) {
    case 'behind-main':
    case 'rebasing-on-main':
      return 'text-info';
    case 'rebase-stopped':
      return 'text-warning';
    case 'up-to-date':
      return 'text-faint-foreground';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly mountId: MountId;
  readonly status: WorktreeStatus | null;
};

type CommitBaseBranchParams = {
  readonly candidate: string | null;
};

type NotifyParams = {
  readonly title: string;
  readonly message: string;
};

export const ProjectSyncControl = ({ sessionId, projectId, mountId, status }: Props) => {
  const dropdown = useDropdown({ width: 'w-64', expectedHeight: 160 });
  const reportError = useAppStore((state) => state.reportError);
  const configuredBaseBranch = useAppStore(
    (state) => state.projects.find((project) => project.id === projectId)?.baseBranch ?? null,
  );
  const repoPath = useAppStore(
    (state) => state.projects.find((project) => project.id === projectId)?.rootPath ?? '',
  );
  const updateProjectBaseBranch = useAppStore((state) => state.updateProjectBaseBranch);
  const [baseError, setBaseError] = useState<string | null>(null);
  const baseBranch = configuredBaseBranch ?? 'main';
  const notify = ({ title, message }: NotifyParams) => {
    void reportError({ title, error: message, sessionId });
  };
  const rebase = useRebaseBranch({
    sessionId,
    mountId,
    status,
    onError: (message) => notify({ title: "Couldn't rebase the branch", message }),
  });
  const push = usePushBranch({
    sessionId,
    mountId,
    onError: (message) => notify({ title: "Couldn't push the branch", message }),
  });

  const distance = status?.mainDistance.kind === 'known' ? status.mainDistance : null;
  const main =
    status == null ? null : mainPresenceOf({ status, isRebasingAgent: rebase.isRunning });
  const upstreamAhead =
    status == null ? null : distanceAhead({ distance: status.upstreamDistance });
  const canPush = upstreamAhead != null && upstreamAhead > 0;
  const commitBaseBranch = async ({ candidate }: CommitBaseBranchParams) => {
    const value = candidate?.trim() ?? '';
    const next = value === '' ? null : value;
    if (next === (configuredBaseBranch ?? null)) {
      setBaseError(null);
      return;
    }
    try {
      await updateProjectBaseBranch({ projectId, baseBranch: next });
      setBaseError(null);
    } catch (error) {
      setBaseError(formatError(error));
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Branch sync actions"
      anchorClassName="shrink-0"
      trigger={
        <Tooltip content="Branch sync actions">
          <button
            type="button"
            aria-label="Branch sync actions"
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
            onClick={dropdown.toggle}
            data-testid="project-sync-trigger"
            className={cn(
              'flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-label transition-colors hover:bg-hover',
              main == null ? 'text-muted-foreground' : mainPresenceToneClass(main.kind),
            )}
          >
            {main == null ? (
              '--'
            ) : (
              <>
                {mainPresenceGlyphOf({ kind: main.kind })}
                <span className="whitespace-nowrap">{main.label}</span>
                <ChevronDown size={10} aria-hidden className="text-faint-foreground" />
              </>
            )}
          </button>
        </Tooltip>
      }
    >
      <div className="flex flex-col py-1">
        <div className="flex flex-col gap-1 border-b border-border-soft px-3 py-2 text-label tabular-nums text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="font-medium text-foreground">Compared with</span>
              <BaseBranchSelect
                repoPath={repoPath}
                value={configuredBaseBranch}
                disabled={repoPath === ''}
                onCommit={(candidate) => commitBaseBranch({ candidate })}
              />
            </div>
            <span className="flex items-center gap-1">
              <ArrowDown size={11} aria-hidden />
              {distance?.behind ?? '--'}
            </span>
            <span className="flex items-center gap-1">
              <ArrowUp size={11} aria-hidden />
              {distance?.ahead ?? '--'}
            </span>
          </div>
          {baseError == null ? null : (
            <span className="text-secondary text-danger">{baseError}</span>
          )}
        </div>
        <button
          type="button"
          disabled={!rebase.canRebase || rebase.isRunning}
          onClick={() => void rebase.run({ mountId })}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-left text-label hover:bg-hover',
            (!rebase.canRebase || rebase.isRunning) && 'opacity-40',
          )}
        >
          <GitBranch size={ICON_SIZE.row} aria-hidden />
          {rebase.isRunning ? `Rebasing on ${baseBranch}` : `Rebase on ${baseBranch}`}
        </button>
        <button
          type="button"
          disabled={!canPush || push.isBusy}
          onClick={() => void push.run()}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-left text-label hover:bg-hover',
            (!canPush || push.isBusy) && 'opacity-40',
          )}
        >
          <Upload size={ICON_SIZE.row} aria-hidden />
          {push.isBusy ? 'Pushing branch' : 'Push branch'}
        </button>
      </div>
    </AnchoredPopover>
  );
};
