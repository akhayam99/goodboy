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
import { Button, Chip, Eyebrow, formatError } from '@goodboy/ui';
import type { WorkspaceGitStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openInEditor } from '../../../../shared/lib/editor';
import {
  distanceAhead,
  distanceBehind,
  changedCount,
  isWorkingTreeClean,
  operationLabel,
  unknownReasonLabel,
  unmergedCount,
} from '../../../../shared/lib/gitStatus';

type Props = {
  readonly rootPath: string;
  readonly status: WorkspaceGitStatus;
};

type Signal = {
  readonly key: string;
  readonly label: string;
  readonly icon: typeof ArrowUp;
};

const signalsOf = ({ status }: { readonly status: WorkspaceGitStatus }): ReadonlyArray<Signal> => {
  const signals: Array<Signal> = [];
  const behind = distanceBehind({ distance: status.upstreamDistance });
  const ahead = distanceAhead({ distance: status.upstreamDistance });
  const changed = changedCount({ workingTree: status.workingTree });
  const unmerged = unmergedCount({ workingTree: status.workingTree });
  if (behind != null && behind > 0) {
    signals.push({ key: 'behind', label: `${behind} to pull`, icon: ArrowDown });
  }
  if (ahead != null && ahead > 0) {
    signals.push({ key: 'ahead', label: `${ahead} to push`, icon: ArrowUp });
  }
  if (changed != null && changed > 0) {
    signals.push({ key: 'dirty', label: `${changed} uncommitted`, icon: Pencil });
  }
  if (unmerged != null && unmerged > 0) {
    signals.push({ key: 'unmerged', label: `${unmerged} conflicted`, icon: GitMerge });
  }
  return signals;
};

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

export const MainStatus = ({ rootPath, status }: Props) => {
  const [openError, setOpenError] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const workspaceId = useAppStore(
    (s) => s.workspaces.find((candidate) => candidate.rootPath === rootPath)?.id ?? null,
  );
  const pulling = useAppStore(
    (s) => workspaceId != null && s.workspaceCheckoutPulling[workspaceId] === true,
  );
  const fastForwardWorkspaceCheckout = useAppStore((s) => s.fastForwardWorkspaceCheckout);
  const signals = signalsOf({ status });
  const notes = unknownNotesOf({ status });
  const branch = status.branch ?? 'detached HEAD';
  const blockedReason = blockedReasonOf({ status });
  const canPull = blockedReason == null && workspaceId != null && !pulling;
  const pullLabel =
    status.upstream != null
      ? `Fast-forward ${branch} to ${status.upstream}`
      : `Fast-forward ${branch}`;

  const onOpen = async () => {
    setOpenError(null);
    try {
      await openInEditor(rootPath);
    } catch (error) {
      setOpenError(formatError(error));
    }
  };

  const onPull = async () => {
    if (workspaceId == null) {
      return;
    }
    setPullError(null);
    try {
      await fastForwardWorkspaceCheckout({ workspaceId });
    } catch (error) {
      setPullError(formatError(error));
    }
  };

  return (
    <section aria-label="Main checkout" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow label="Main checkout" muted />
        <span className="flex min-w-0 items-center gap-1 text-xs text-foreground">
          <GitBranch size={11} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{branch}</span>
        </span>
        {signals.length === 0 && notes.length === 0 ? (
          <span className="flex items-center gap-1 text-2xs text-muted-foreground">
            <Check size={11} aria-hidden />
            {status.upstream != null ? 'In sync and clean' : 'Clean, no upstream yet'}
          </span>
        ) : (
          signals.map((signal) => (
            <Chip
              key={signal.key}
              size="sm"
              tone="neutral"
              icon={<signal.icon size={10} aria-hidden />}
              label={signal.label}
            />
          ))
        )}
        {notes.length > 0 ? (
          <span className="flex items-center gap-1 text-2xs text-warning">
            <AlertTriangle size={11} aria-hidden />
            Goodboy cannot read this checkout
          </span>
        ) : null}
        <span className="min-w-0 flex-1" aria-hidden />
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
          Open main in editor
        </Button>
      </div>
      {notes.map((note) => (
        <span key={note} className="text-2xs text-muted-foreground">
          {note}
        </span>
      ))}
      {blockedReason != null && notes.length === 0 ? (
        <span className="text-2xs text-muted-foreground/70">{blockedReason}</span>
      ) : null}
      {pullError != null ? (
        <span role="alert" className="text-2xs text-danger">
          {pullError}
        </span>
      ) : null}
      {openError != null ? (
        <span role="alert" className="text-2xs text-danger">
          {openError}
        </span>
      ) : (
        <span className="text-2xs text-muted-foreground/70">
          Sessions keep working in their own worktree, never on this checkout.
        </span>
      )}
    </section>
  );
};
