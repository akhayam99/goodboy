import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  FolderOpen,
  GitBranch,
  GitMerge,
  Pencil,
} from 'lucide-react';
import { AnchoredPopover, Button, cn, formatError, useDropdown } from '@goodboy/ui';
import type { GitUnknownReason, Project, WorkspaceGitStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openInEditor } from '../../../../shared/lib/editor';
import {
  changedCount,
  distanceAhead,
  distanceBehind,
  isWorkingTreeClean,
  operationLabel,
  unknownReasonLabel,
  unmergedCount,
} from '../../../../shared/lib/gitStatus';
import { InitGuide } from './InitGuide';

type Props = {
  readonly project: Project;
  readonly status: WorkspaceGitStatus | null;
  readonly shouldShowProjectName: boolean;
};

type Detail = {
  readonly key: string;
  readonly label: string;
  readonly icon: typeof ArrowDown;
};

const isReadFailureReason = ({ reason }: { readonly reason: GitUnknownReason }): boolean => {
  switch (reason) {
    case 'no-upstream':
    case 'detached-head':
      return false;
    case 'rev-list-failed':
    case 'main-ref-unresolved':
    case 'status-read-failed':
      return true;
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
};

const hasReadFailure = ({ status }: { readonly status: WorkspaceGitStatus }): boolean =>
  (status.upstreamDistance.kind === 'unknown' &&
    isReadFailureReason({ reason: status.upstreamDistance.reason })) ||
  (status.workingTree.kind === 'unknown' &&
    isReadFailureReason({ reason: status.workingTree.reason }));

const unknownNotesOf = ({
  status,
}: {
  readonly status: WorkspaceGitStatus;
}): ReadonlyArray<string> => {
  const notes: Array<string> = [];
  if (
    status.upstreamDistance.kind === 'unknown' &&
    status.upstreamDistance.reason !== 'no-upstream'
  ) {
    notes.push(unknownReasonLabel({ reason: status.upstreamDistance.reason }));
  }
  if (status.workingTree.kind === 'unknown') {
    notes.push(unknownReasonLabel({ reason: status.workingTree.reason }));
  }
  if (status.inProgress != null) {
    notes.push(`a ${operationLabel({ operation: status.inProgress })} is in progress`);
  }
  return notes;
};

const blockedReasonOf = ({ status }: { readonly status: WorkspaceGitStatus }): string | null => {
  if (status.branch == null) {
    return unknownReasonLabel({ reason: 'detached-head' });
  }
  if (status.upstream == null) {
    return 'this branch tracks no upstream yet';
  }
  if (status.inProgress != null) {
    return `finish the ${operationLabel({ operation: status.inProgress })} in progress first`;
  }
  if (status.workingTree.kind === 'unknown') {
    return unknownReasonLabel({ reason: status.workingTree.reason });
  }
  if (!isWorkingTreeClean({ workingTree: status.workingTree })) {
    return 'commit or stash the uncommitted changes first';
  }
  if (status.upstreamDistance.kind === 'unknown') {
    return unknownReasonLabel({ reason: status.upstreamDistance.reason });
  }
  if (status.upstreamDistance.behind === 0) {
    return 'already up to date';
  }
  return null;
};

const detailsOf = ({ status }: { readonly status: WorkspaceGitStatus }): ReadonlyArray<Detail> => {
  const details: Array<Detail> = [];
  const behind = distanceBehind({ distance: status.upstreamDistance });
  const ahead = distanceAhead({ distance: status.upstreamDistance });
  const changed = changedCount({ workingTree: status.workingTree });
  const unmerged = unmergedCount({ workingTree: status.workingTree });
  if (behind != null && behind > 0) {
    details.push({ key: 'behind', label: `${behind} to pull`, icon: ArrowDown });
  }
  if (ahead != null && ahead > 0) {
    details.push({ key: 'ahead', label: `${ahead} to push`, icon: ArrowUp });
  }
  if (changed != null && changed > 0) {
    details.push({ key: 'changed', label: `${changed} uncommitted`, icon: Pencil });
  }
  if (unmerged != null && unmerged > 0) {
    details.push({ key: 'unmerged', label: `${unmerged} conflicted`, icon: GitMerge });
  }
  return details;
};

export const ProjectGitPill = ({ project, status, shouldShowProjectName }: Props) => {
  const isSetup = status?.state === 'absent' || status?.state === 'unborn';
  const dropdown = useDropdown({
    width: isSetup ? 'w-96' : 'w-72',
    expectedWidth: isSetup ? 384 : 288,
    expectedHeight: isSetup ? 520 : 260,
    align: 'end',
  });
  const [openError, setOpenError] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const pulling = useAppStore((state) => state.projectCheckoutPulling[project.id] === true);
  const fastForwardProjectCheckout = useAppStore((state) => state.fastForwardProjectCheckout);
  const isReady = status?.state === 'ready';
  const details = isReady ? detailsOf({ status }) : [];
  const notes = isReady ? unknownNotesOf({ status }) : [];
  const readFailure = isReady && hasReadFailure({ status });
  const isWarning = status != null && (status.state !== 'ready' || readFailure);
  const behind = isReady ? (distanceBehind({ distance: status.upstreamDistance }) ?? 0) : 0;
  const changed = isReady ? (changedCount({ workingTree: status.workingTree }) ?? 0) : 0;
  const unmerged = isReady ? (unmergedCount({ workingTree: status.workingTree }) ?? 0) : 0;
  const actionableCount = behind + changed + unmerged;
  const branch = isReady
    ? (status.branch ?? 'detached HEAD')
    : status?.state === 'missing'
      ? 'Unreachable'
      : 'Git setup';
  const label = shouldShowProjectName ? `${project.name} · ${branch}` : branch;
  const blockedReason = isReady ? blockedReasonOf({ status }) : null;
  const canPull = isReady && blockedReason == null && !pulling;
  const pullLabel = isReady
    ? status.upstream != null
      ? `Fast-forward ${branch} to ${status.upstream}`
      : `Fast-forward ${branch}`
    : 'Fast-forward';

  const onOpen = async () => {
    setOpenError(null);
    try {
      await openInEditor(project.rootPath);
    } catch (error) {
      setOpenError(formatError(error));
    }
  };

  const onPull = async () => {
    setPullError(null);
    try {
      await fastForwardProjectCheckout({ projectId: project.id });
    } catch (error) {
      setPullError(formatError(error));
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={`${project.name} git status`}
      className={cn('max-h-[min(32rem,calc(100vh-2rem))] overflow-y-auto', isSetup && 'w-96')}
      trigger={
        <button
          type="button"
          aria-label={`${project.name} git status: ${branch}`}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn(
            'relative inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            actionableCount > 0 || isWarning
              ? 'text-foreground hover:bg-muted/60'
              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
          )}
        >
          <GitBranch size={12} aria-hidden className="shrink-0" />
          <span className="max-w-36 truncate">{label}</span>
          {isWarning ? (
            <span data-testid="project-git-warning" className="flex items-center text-warning">
              <AlertTriangle size={10} aria-hidden />
            </span>
          ) : actionableCount > 0 ? (
            <span
              data-testid="project-git-count"
              className="flex min-w-3.5 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-semibold leading-3.5 text-warning-foreground"
            >
              {actionableCount}
            </span>
          ) : null}
        </button>
      }
    >
      <div className="flex flex-col">
        {status == null ? (
          <div className="p-3 text-xs text-muted-foreground">Reading git status</div>
        ) : status.state === 'missing' ? (
          <div className="flex items-start gap-2 p-3 text-xs leading-relaxed text-danger">
            <AlertTriangle size={13} aria-hidden className="shrink-0" />
            <span>
              Goodboy cannot reach <span className="font-mono text-2xs">{project.rootPath}</span>.
              Reconnect the workspace once the folder is back.
            </span>
          </div>
        ) : status.state === 'absent' || status.state === 'unborn' ? (
          <InitGuide rootPath={project.rootPath} state={status.state} />
        ) : (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex flex-col gap-1.5">
              {details.length === 0 && notes.length === 0 ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Check size={11} aria-hidden />
                  {status.upstream != null ? 'In sync and clean' : 'Clean, no upstream yet'}
                </span>
              ) : null}
              {details.map((detail) => (
                <span
                  key={detail.key}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <detail.icon size={11} aria-hidden />
                  {detail.label}
                </span>
              ))}
              {readFailure ? (
                <span className="flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle size={11} aria-hidden />
                  Goodboy cannot read this checkout
                </span>
              ) : null}
              {notes.map((note) => (
                <span key={note} className="text-2xs text-muted-foreground">
                  {note}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1 border-t border-border-soft pt-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!canPull}
                title={blockedReason ?? undefined}
                onClick={() => void onPull()}
              >
                <ArrowDown size={13} aria-hidden />
                {pulling ? 'Pulling' : pullLabel}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void onOpen()}>
                <FolderOpen size={13} aria-hidden />
                Open in editor
              </Button>
            </div>
            {pullError != null ? (
              <span role="alert" className="text-2xs text-danger">
                {pullError}
              </span>
            ) : null}
            {openError != null ? (
              <span role="alert" className="text-2xs text-danger">
                {openError}
              </span>
            ) : null}
          </div>
        )}
        <span className="border-t border-border-soft px-3 py-2 text-2xs text-muted-foreground/70">
          Sessions keep working in their own worktree, never on this checkout.
        </span>
      </div>
    </AnchoredPopover>
  );
};
