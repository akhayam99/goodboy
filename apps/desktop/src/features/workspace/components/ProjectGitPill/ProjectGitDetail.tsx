import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  FolderOpen,
  GitMerge,
  Pencil,
  Upload,
} from 'lucide-react';
import { Button, SkeletonRow, formatError } from '@goodboy/ui';
import type { Project, WorkspaceGitStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openInEditor } from '../../../../shared/lib/editor';
import { initRepo } from '../../../../shared/lib/repo';
import { resolveEditorBinary } from '../../../../shared/lib/editorSettings';
import { BaseBranchSelect } from '../../../worktree/BaseBranchSelect';
import { commitBaseBranch as commitProjectBaseBranch } from '../../../worktree/commitBaseBranch';
import {
  changedCount,
  distanceAhead,
  distanceBehind,
  operationLabel,
  unknownReasonLabel,
  unmergedCount,
} from '../../../../shared/lib/gitStatus';
import { PublishPanel } from '../../../bootstrap/PublishPanel';
import { InitGuide } from './InitGuide';
import {
  hasReadFailure,
  projectUpdateBlockReasonOf,
} from '../../../../shared/lib/projectGitPresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly project: Project;
  readonly status: WorkspaceGitStatus | null;
};

type Detail = {
  readonly key: string;
  readonly label: string;
  readonly icon: typeof ArrowDown;
};

type StatusParams = {
  readonly status: WorkspaceGitStatus;
};

type CapitalizeParams = {
  readonly value: string;
};

type CommitBaseBranchParams = {
  readonly candidate: string | null;
};

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
  const [baseBranchError, setBaseBranchError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const editor = useAppStore((state) => resolveEditorBinary({ settings: state.settings }));
  const pulling = useAppStore((state) => state.projectCheckoutPulling[project.id] === true);
  const fastForwardProjectCheckout = useAppStore((state) => state.fastForwardProjectCheckout);
  const updateProjectBaseBranch = useAppStore((state) => state.updateProjectBaseBranch);
  const loadProjectGitStatus = useAppStore((state) => state.loadProjectGitStatus);
  const isFirstLap = useAppStore(
    (state) => state.bootstrapPhase[project.id]?.stage === 'first-lap',
  );
  const isReady = status?.state === 'ready';
  const canPublish =
    isReady &&
    status.upstream == null &&
    (project.remoteUrl === undefined || project.remoteUrl === '');
  const details = isReady ? detailsOf({ status }) : [];
  const notes = isReady ? unknownNotesOf({ status }) : [];
  const readFailure = isReady && hasReadFailure({ status });
  const branch = isReady ? (status.branch ?? 'detached HEAD') : '';
  const blockedReason = isReady ? projectUpdateBlockReasonOf({ status }) : null;
  const canPull = isReady && blockedReason == null && !pulling;
  const pullLabel = isReady
    ? status.upstream != null
      ? `Fast-forward ${branch} to ${status.upstream}`
      : `Fast-forward ${branch}`
    : 'Fast-forward';

  const onOpen = async () => {
    setOpenError(null);
    try {
      await openInEditor({ path: project.rootPath, editor });
    } catch (error) {
      setOpenError(formatError(error));
    }
  };
  const onStartRepository = async () => {
    await initRepo({ path: project.rootPath });
    await loadProjectGitStatus({ projectId: project.id });
  };
  const onPull = async () => {
    setPullError(null);
    try {
      await fastForwardProjectCheckout({ projectId: project.id });
    } catch (error) {
      setPullError(formatError(error));
    }
  };
  const commitBaseBranch = async ({ candidate }: CommitBaseBranchParams) => {
    setBaseBranchError(null);
    try {
      await commitProjectBaseBranch({
        projectId: project.id,
        currentBaseBranch: project.baseBranch ?? null,
        candidate,
        updateProjectBaseBranch,
      });
    } catch (error) {
      setBaseBranchError(formatError(error));
    }
  };

  return (
    <div className="flex flex-col">
      {status == null ? (
        <SkeletonRow label="Reading git status" className="m-2" />
      ) : status.state === 'missing' ? (
        <div className="flex items-start gap-2 p-3 text-label text-danger">
          <AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span>
            Goodboy cannot reach <span className="font-mono text-meta">{project.rootPath}</span>.
            Reconnect the workspace once the folder is back.
          </span>
        </div>
      ) : status.state === 'absent' || status.state === 'unborn' ? (
        <InitGuide rootPath={project.rootPath} state={status.state} onStart={onStartRepository} />
      ) : (
        <div className="flex flex-col gap-2 p-3">
          <div className="flex flex-col gap-2">
            {details.length === 0 && notes.length === 0 ? (
              <span className="flex items-center gap-1 text-label text-muted-foreground">
                <Check size={ICON_SIZE.mark} aria-hidden />
                {status.upstream != null ? 'In sync and clean' : 'Clean, no upstream yet'}
              </span>
            ) : null}
            {details.map((detail) => (
              <span
                key={detail.key}
                className="flex items-center gap-2 text-label text-muted-foreground"
              >
                <detail.icon size={ICON_SIZE.mark} aria-hidden />
                {detail.label}
              </span>
            ))}
            {readFailure ? (
              <span className="flex items-center gap-1 text-label text-warning">
                <AlertTriangle size={ICON_SIZE.mark} aria-hidden />
                Goodboy cannot read this checkout
              </span>
            ) : null}
            {notes.map((note) => (
              <span key={note} className="text-meta text-muted-foreground">
                {note}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1 border-t border-border-soft pt-2">
            <span className="flex items-center gap-2 text-meta text-muted-foreground">
              <span className="shrink-0">Base branch</span>
              <BaseBranchSelect
                repoPath={project.rootPath}
                value={project.baseBranch ?? null}
                onCommit={(candidate) => commitBaseBranch({ candidate })}
              />
            </span>
            {baseBranchError != null ? (
              <span role="alert" className="text-meta text-danger">
                {baseBranchError}
              </span>
            ) : null}
            <Button size="sm" variant="ghost" disabled={!canPull} onClick={() => void onPull()}>
              <ArrowDown size={ICON_SIZE.row} aria-hidden />
              {pulling ? 'Pulling' : pullLabel}
            </Button>
            {blockedReason != null ? (
              blockedReason === 'already up to date' ? (
                <span className="flex items-center gap-1 px-1 text-meta text-muted-foreground">
                  <Check size={ICON_SIZE.mark} aria-hidden />
                  {`${capitalize({ value: blockedReason })}.`}
                </span>
              ) : (
                <span className="px-1 text-meta text-muted-foreground">
                  {`${capitalize({ value: blockedReason })}.`}
                </span>
              )
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => void onOpen()}>
              <FolderOpen size={ICON_SIZE.row} aria-hidden />
              Open in editor
            </Button>
            {canPublish && !isPublishing ? (
              <Button size="sm" variant="ghost" onClick={() => setIsPublishing(true)}>
                <Upload size={ICON_SIZE.row} aria-hidden />
                Publish
              </Button>
            ) : null}
          </div>
          {canPublish && isPublishing ? (
            <PublishPanel
              project={project}
              onPublished={() => setIsPublishing(false)}
              onCancel={() => setIsPublishing(false)}
            />
          ) : null}
          {pullError != null ? (
            <span role="alert" className="text-meta text-danger">
              {pullError}
            </span>
          ) : null}
          {openError != null ? (
            <span role="alert" className="text-meta text-danger">
              {openError}
            </span>
          ) : null}
        </div>
      )}
      <span className="border-t border-border-soft px-3 py-2 text-meta text-faint-foreground">
        {isFirstLap
          ? 'This project works in its own folder until it is published.'
          : 'Sessions keep working in their own worktree, never on this checkout.'}
      </span>
    </div>
  );
};
