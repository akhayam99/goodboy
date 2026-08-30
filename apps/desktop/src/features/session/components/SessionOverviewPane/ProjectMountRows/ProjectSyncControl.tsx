import { useState } from 'react';
import { ArrowDown, ArrowUp, GitBranch, Pencil, RefreshCw, Upload } from 'lucide-react';
import { AnchoredPopover, Input, cn, formatError, useDropdown } from '@goodboy/ui';
import type { ProjectId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { distanceAhead } from '../../../../../shared/lib/gitStatus';
import { useRebaseAgent } from '../../../hooks/useRebaseAgent';
import { usePushBranch } from '../../../hooks/usePushBranch';

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly status: WorktreeStatus | null;
};

export const ProjectSyncControl = ({ sessionId, projectId, status }: Props) => {
  const dropdown = useDropdown({ width: 'w-64', expectedHeight: 160 });
  const setSessionActiveProject = useAppStore((state) => state.setSessionActiveProject);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const configuredBaseBranch = useAppStore(
    (state) => state.projects.find((project) => project.id === projectId)?.baseBranch ?? null,
  );
  const updateProjectBaseBranch = useAppStore((state) => state.updateProjectBaseBranch);
  const [isEditingBase, setIsEditingBase] = useState(false);
  const [baseDraft, setBaseDraft] = useState('');
  const [baseError, setBaseError] = useState<string | null>(null);
  const baseBranch = configuredBaseBranch ?? 'main';
  const notify = ({ title, message }: { readonly title: string; readonly message: string }) => {
    void emitNotification('error', 'error', title, message, { sessionId });
  };
  const rebase = useRebaseAgent({
    sessionId,
    status,
    onError: (message) => notify({ title: 'Rebase failed', message }),
  });
  const push = usePushBranch({
    sessionId,
    onError: (message) => notify({ title: 'Push failed', message }),
  });

  const distance = status?.mainDistance.kind === 'known' ? status.mainDistance : null;
  const upstreamAhead =
    status == null ? null : distanceAhead({ distance: status.upstreamDistance });
  const canPush = upstreamAhead != null && upstreamAhead > 0;
  const targetProject = async ({ action }: { readonly action: () => Promise<void> }) => {
    await setSessionActiveProject({ sessionId, projectId });
    await action();
  };
  const startBaseEdit = () => {
    setBaseDraft(configuredBaseBranch ?? '');
    setBaseError(null);
    setIsEditingBase(true);
  };
  const cancelBaseEdit = () => {
    setBaseDraft(configuredBaseBranch ?? '');
    setBaseError(null);
    setIsEditingBase(false);
  };
  const commitBaseEdit = async () => {
    const value = baseDraft.trim();
    const next = value === '' ? null : value;
    if (next === (configuredBaseBranch ?? null)) {
      setBaseError(null);
      setIsEditingBase(false);
      return;
    }
    try {
      await updateProjectBaseBranch({ projectId, baseBranch: next });
      setBaseError(null);
      setIsEditingBase(false);
    } catch (error) {
      setBaseError(formatError(error));
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Branch sync actions"
      trigger={
        <button
          type="button"
          aria-label="Branch sync actions"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className="relative inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <RefreshCw size={13} aria-hidden />
          {distance != null && distance.behind > 0 ? (
            <span
              data-testid="project-behind-badge"
              className="absolute -right-1 -top-1 flex min-w-3.5 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-semibold leading-3.5 text-warning-foreground"
            >
              {distance.behind}
            </span>
          ) : null}
        </button>
      }
    >
      <div className="flex flex-col py-1">
        <div className="flex flex-col gap-1 border-b border-border-soft px-3 py-2 text-xs tabular-nums text-muted-foreground">
          <div className="group flex items-center gap-3">
            {isEditingBase ? (
              <Input
                autoFocus
                aria-label="Base branch"
                placeholder="main"
                value={baseDraft}
                onChange={(event) => setBaseDraft(event.target.value)}
                onBlur={() => void commitBaseEdit()}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    cancelBaseEdit();
                    return;
                  }
                  if (event.key !== 'Enter') {
                    return;
                  }
                  event.preventDefault();
                  event.currentTarget.blur();
                }}
                className="h-7 font-mono text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={startBaseEdit}
                className="flex items-center gap-1 font-medium text-foreground"
              >
                <span>Compared with</span>
                <span className="rounded px-1 font-mono hover:bg-muted/60">{baseBranch}</span>
                <Pencil
                  size={10}
                  aria-hidden
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            )}
            <span className="ml-auto flex items-center gap-1">
              <ArrowDown size={11} aria-hidden />
              {distance?.behind ?? '--'}
            </span>
            <span className="flex items-center gap-1">
              <ArrowUp size={11} aria-hidden />
              {distance?.ahead ?? '--'}
            </span>
          </div>
          {baseError == null ? null : <span className="text-2xs text-danger">{baseError}</span>}
        </div>
        <button
          type="button"
          disabled={!rebase.canRebase || rebase.isRunning}
          onClick={() => void targetProject({ action: rebase.run })}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40',
            (!rebase.canRebase || rebase.isRunning) && 'opacity-40',
          )}
        >
          <GitBranch size={12} aria-hidden />
          {rebase.isRunning ? `Rebasing on ${baseBranch}` : `Rebase on ${baseBranch}`}
        </button>
        <button
          type="button"
          disabled={!canPush || push.isBusy}
          onClick={() => void targetProject({ action: push.run })}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40',
            (!canPush || push.isBusy) && 'opacity-40',
          )}
        >
          <Upload size={12} aria-hidden />
          {push.isBusy ? 'Pushing branch' : 'Push branch'}
        </button>
      </div>
    </AnchoredPopover>
  );
};
