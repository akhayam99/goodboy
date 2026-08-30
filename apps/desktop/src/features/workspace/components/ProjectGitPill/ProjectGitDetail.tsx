import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  FolderOpen,
  GitMerge,
  Pencil,
} from 'lucide-react';
import { Button, formatError } from '@goodboy/ui';
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
};

type Detail = {
  readonly key: string;
  readonly label: string;
  readonly icon: typeof ArrowDown;
};

type ReasonParams = {
  readonly reason: GitUnknownReason;
};

type StatusParams = {
  readonly status: WorkspaceGitStatus;
};

type CapitalizeParams = {
  readonly value: string;
};

const isReadFailureReason = ({ reason }: ReasonParams): boolean => {
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

const hasReadFailure = ({ status }: StatusParams): boolean =>
  (status.upstreamDistance.kind === 'unknown' &&
    isReadFailureReason({ reason: status.upstreamDistance.reason })) ||
  (status.workingTree.kind === 'unknown' &&
    isReadFailureReason({ reason: status.workingTree.reason }));

const unknownNotesOf = ({ status }: StatusParams): ReadonlyArray<string> => {
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

const blockedReasonOf = ({ status }: StatusParams): string | null => {
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

const detailsOf = ({ status }: StatusParams): ReadonlyArray<Detail> => {
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

const capitalize = ({ value }: CapitalizeParams): string =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export const ProjectGitDetail = ({ project, status }: Props) => {
  const [openError, setOpenError] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [baseBranch, setBaseBranch] = useState(project.baseBranch ?? '');
  const [baseBranchError, setBaseBranchError] = useState<string | null>(null);
  const pulling = useAppStore((state) => state.projectCheckoutPulling[project.id] === true);
  const fastForwardProjectCheckout = useAppStore((state) => state.fastForwardProjectCheckout);
  const updateProjectBaseBranch = useAppStore((state) => state.updateProjectBaseBranch);
  const isReady = status?.state === 'ready';
  const details = isReady ? detailsOf({ status }) : [];
  const notes = isReady ? unknownNotesOf({ status }) : [];
  const readFailure = isReady && hasReadFailure({ status });
  const branch = isReady ? (status.branch ?? 'detached HEAD') : '';
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
  const commitBaseBranch = async () => {
    const trimmedBaseBranch = baseBranch.trim();
    const nextBaseBranch = trimmedBaseBranch === '' ? null : trimmedBaseBranch;
    if (nextBaseBranch === project.baseBranch) {
      setBaseBranch(project.baseBranch ?? '');
      return;
    }
    setBaseBranchError(null);
    try {
      await updateProjectBaseBranch({ projectId: project.id, baseBranch: nextBaseBranch });
      setBaseBranch(nextBaseBranch ?? '');
    } catch (error) {
      setBaseBranchError(formatError(error));
    }
  };

  return (
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
            <label className="flex items-center gap-2 text-2xs text-muted-foreground">
              <span className="shrink-0">Base branch</span>
              <input
                type="text"
                value={baseBranch}
                placeholder="main"
                aria-label={`${project.name} base branch`}
                onChange={(event) => setBaseBranch(event.target.value)}
                onBlur={() => void commitBaseBranch()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
                className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            {baseBranchError != null ? (
              <span role="alert" className="text-2xs text-danger">
                {baseBranchError}
              </span>
            ) : null}
            <Button size="sm" variant="ghost" disabled={!canPull} onClick={() => void onPull()}>
              <ArrowDown size={13} aria-hidden />
              {pulling ? 'Pulling' : pullLabel}
            </Button>
            {blockedReason != null ? (
              blockedReason === 'already up to date' ? (
                <span className="flex items-center gap-1 px-1 text-2xs leading-relaxed text-muted-foreground">
                  <Check size={11} aria-hidden />
                  {`${capitalize({ value: blockedReason })}.`}
                </span>
              ) : (
                <span className="px-1 text-2xs leading-relaxed text-muted-foreground">
                  {`${capitalize({ value: blockedReason })}.`}
                </span>
              )
            ) : null}
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
  );
};
