import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorStrip, LensEmptyState, PageColumn, Skeleton, cn, formatError } from '@goodboy/ui';
import type { DiffView as DiffViewKind, SessionId } from '@goodboy/types';
import { useAppStore, type DiffFocus } from '../../../../store';
import {
  selectMountBaseBranch,
  selectMountForPath,
} from '../../../../store/slices/project-mounts/selectors';
import { isMountRequestMerged } from '../../../../store/slices/project-mounts/mountRowModel';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { openFileInWorkspace } from '../../../../shared/lib/editor';
import { resolveEditorBinary } from '../../../../shared/lib/editorSettings';
import { distanceAhead, distanceBehind } from '../../../../shared/lib/gitStatus';
import { branchStateOf } from '../../../session/trail/menus/branchMenu';
import { ActionButtons } from '../../../actions/components/ActionControls/ActionButtons';
import { ActionConfirmPanel } from '../../../actions/components/ActionControls/ActionConfirmPanel';
import { ActionStatusLine } from '../../../actions/components/ActionControls/ActionStatusLine';
import { DIFF_CHANGE_BASE_EVENT, diffEventName } from '../../../actions/kinds/diff';
import type { DiffActionTarget } from '../../../actions/types';
import { useActionControls } from '../../../actions/useActionControls';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';
import { DiffBaseBranchRow } from './DiffBaseBranchRow';
import { useRebaseBranch } from '../../../session/hooks/useRebaseBranch';
import { useRebasePrediction } from '../../../history/useRebasePrediction';
import { DiffViewSelector } from '../../../permissions/components/DiffViewSelector';
import { useDiffNotes } from '../../hooks/useDiffNotes';
import { useDiffReviewThreads } from '../../hooks/useDiffReviewThreads';
import { useSessionDiff } from '../../hooks/useSessionDiff';
import { DiffView } from '../DiffView';
import { DiffNotesActions } from '../DiffNotesActions';

export const DIFF_PANE_TITLE = 'Diff';

type Props = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly worktreePath: string;
  readonly diffFocus: DiffFocus | null;
  readonly branchRevision: number;
};

const baseWord = (baseBranch: string | null): string => baseBranch ?? 'its base branch';

const emptyTitle = (view: DiffViewKind, baseBranch: string | null): string => {
  if (view.kind === 'working') {
    if (view.scope === 'staged') {
      return 'No staged changes';
    }
    if (view.scope === 'unstaged') {
      return 'No unstaged changes';
    }
    return 'Working tree clean';
  }
  if (view.kind === 'commit') {
    return 'This commit is empty';
  }
  return `Branch matches ${baseWord(baseBranch)}`;
};

const emptyBlurb = (view: DiffViewKind, baseBranch: string | null): string => {
  if (view.kind === 'working') {
    if (view.scope === 'staged') {
      return 'Nothing has been staged for the next commit yet.';
    }
    if (view.scope === 'unstaged') {
      return 'No uncommitted edits in the working tree.';
    }
    return 'No uncommitted edits and nothing staged.';
  }
  if (view.kind === 'commit') {
    return 'No file changes were recorded for this commit.';
  }
  return `Every commit on this branch is already reachable from ${baseWord(baseBranch)}, nothing extra to review.`;
};

export const SessionDiffPane = ({
  sessionId,
  workingDir,
  worktreePath,
  diffFocus,
  branchRevision,
}: Props) => {
  const diff = useSessionDiff({ sessionId, worktreePath, diffFocus, branchRevision });
  const { comments: noteComments, openNotes } = useDiffNotes({ sessionId });
  const mountId = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.mountId ?? null,
  );
  const reviewThreads = useDiffReviewThreads({ sessionId, mountId });
  const comments = useMemo(
    () =>
      reviewThreads.length === 0
        ? noteComments
        : { ...noteComments, threads: [...noteComments.threads, ...reviewThreads] },
    [noteComments, reviewThreads],
  );
  const isRequestMerged = useAppStore((s) =>
    mountId === null ? false : isMountRequestMerged({ state: s, mountId }),
  );
  const rebase = useRebaseBranch({ sessionId, mountId, status: diff.status });
  const editorBinary = useAppStore((s) => resolveEditorBinary({ settings: s.settings }));
  const emitNotification = useAppStore((s) => s.emitNotification);

  const isEmpty = !diff.loading && diff.error === null && diff.files.length === 0;
  const mountBaseBranch = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.baseBranch ?? null,
  );
  const mountRepoRoot = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.repoRoot ?? null,
  );
  const mountProjectId = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.projectId ?? null,
  );
  const projectRoot = useAppStore(
    (s) => s.projects.find((project) => project.id === mountProjectId)?.rootPath ?? '',
  );
  const projectBaseBranch = useAppStore(
    (s) => s.projects.find((project) => project.id === mountProjectId)?.baseBranch ?? null,
  );
  const remoteKind = useMountRemoteHostKind({ sessionId, repoRoot: mountRepoRoot });
  const [isChangingBase, setIsChangingBase] = useState(false);
  const mountName = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.mountName ?? null,
  );
  const mountBranch = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.branch ?? null,
  );
  const baseBranch = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );

  const openInEditor = useCallback(
    async (filePath: string) => {
      if (workingDir === null) {
        return;
      }
      const root = workingDir.replace(/\/$/, '');
      try {
        await openFileInWorkspace(root, `${root}/${filePath}`, editorBinary);
      } catch (err) {
        void emitNotification({
          kind: 'error',
          severity: 'error',
          title: "Couldn't open the file in your editor",
          body: formatError(err),
          sessionId,
        });
      }
    },
    [editorBinary, emitNotification, sessionId, workingDir],
  );
  const fileActions = useMemo(
    () =>
      workingDir === null ? null : { onOpenInEditor: (path: string) => void openInEditor(path) },
    [openInEditor, workingDir],
  );

  const totals = useMemo(
    () =>
      diff.files.reduce(
        (sum, file) => ({ adds: sum.adds + file.additions, dels: sum.dels + file.deletions }),
        { adds: 0, dels: 0 },
      ),
    [diff.files],
  );
  const mainDistance = diff.status?.mainDistance ?? null;
  const ahead = mainDistance === null ? null : distanceAhead({ distance: mainDistance });
  const behind = mainDistance === null ? null : distanceBehind({ distance: mainDistance });

  const branchState = branchStateOf({
    status: diff.status,
    mount:
      mountRepoRoot === null
        ? null
        : { baseBranch: mountBaseBranch, worktreePath, repoRoot: mountRepoRoot },
    isRequestMerged,
  });
  const meta = (
    <span className="flex flex-wrap items-center gap-1.5">
      {mountName !== null ? <span>{mountName}</span> : null}
      {ahead !== null ? (
        <>
          <span aria-hidden>·</span>
          <span>
            {ahead} {ahead === 1 ? 'commit' : 'commits'}
          </span>
        </>
      ) : null}
      {branchState !== null ? (
        <>
          <span aria-hidden>·</span>
          <span
            className={cn(
              'inline-flex items-center gap-1',
              branchState.tone === 'warning' && 'text-warning',
            )}
          >
            {branchState.glyph !== undefined ? <branchState.glyph size={10} aria-hidden /> : null}
            {branchState.word}
          </span>
        </>
      ) : null}
    </span>
  );
  const canRebase = rebase.canRebase && mountId !== null && behind !== null && behind > 0;
  const rebasePrediction = useRebasePrediction({
    worktreePath,
    baseBranch,
    head: diff.status?.head ?? null,
    isEnabled: canRebase && !rebase.isRunning,
  });

  const conflictCount = rebasePrediction?.conflictFiles.length ?? 0;
  const target = useMemo<DiffActionTarget>(
    () => ({
      kind: 'diff',
      sessionId,
      worktreePath,
      status: diff.status,
      remoteKind,
      patch: diff.patch,
      rebaseConflicts: conflictCount,
    }),
    [conflictCount, diff.patch, diff.status, remoteKind, sessionId, worktreePath],
  );
  const controls = useActionControls({ target });

  useEffect(() => {
    const name = diffEventName({ name: DIFF_CHANGE_BASE_EVENT, sessionId });
    const onChange = () => setIsChangingBase(true);
    window.addEventListener(name, onChange);
    return () => window.removeEventListener(name, onChange);
  }, [sessionId]);

  const actions = <ActionButtons controls={controls} menuLabel="Diff actions" />;

  const toolbar = (
    <div className="flex min-w-0 items-center gap-2">
      <DiffViewSelector
        view={diff.view}
        onChange={diff.setView}
        commits={diff.commits}
        status={diff.status}
        filesCount={diff.loading || diff.error !== null ? null : diff.files.length}
        loading={diff.loading}
      />
      {diff.loading || diff.error !== null ? null : (
        <span className="flex items-center gap-1.5 text-secondary tabular-nums text-muted-foreground">
          <span>
            {diff.files.length} {diff.files.length === 1 ? 'file' : 'files'}
          </span>
          <span className="text-success">+{totals.adds}</span>
          <span className="text-danger">−{totals.dels}</span>
        </span>
      )}
    </div>
  );

  const hasStatusLine =
    controls.failure !== null ||
    [...controls.inSlot({ slot: 'primary' }), ...controls.inSlot({ slot: 'secondary' })].some(
      (action) => action.blockedReason !== null,
    );
  const hasNotices =
    rebase.error !== null ||
    diff.metaError !== null ||
    controls.confirming !== null ||
    hasStatusLine ||
    (isChangingBase && mountProjectId !== null);
  const notices = hasNotices ? (
    <PageColumn className="flex flex-col gap-2 pb-2">
      <ActionStatusLine controls={controls} />
      <ActionConfirmPanel controls={controls} />
      {isChangingBase && mountProjectId !== null ? (
        <DiffBaseBranchRow
          projectId={mountProjectId}
          repoPath={projectRoot}
          value={projectBaseBranch}
          onDone={() => setIsChangingBase(false)}
        />
      ) : null}
      {rebase.error !== null ? (
        <p role="alert" className="text-secondary text-danger" title={rebase.error}>
          {rebase.error}
        </p>
      ) : null}
      {diff.metaError !== null ? (
        <p role="status" className="text-secondary text-muted-foreground" title={diff.metaError}>
          Couldn't read this branch's commits.
        </p>
      ) : null}
    </PageColumn>
  ) : null;

  const body = diff.loading ? (
    <PageColumn className="flex flex-col gap-3">
      {[0, 1].map((index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-3 w-3/4 rounded-sm" />
          <Skeleton className="h-3 w-1/2 rounded-sm" />
        </div>
      ))}
    </PageColumn>
  ) : diff.error !== null ? (
    <PageColumn>
      <ErrorStrip label="the diff" error={new Error(diff.error)} onRetry={diff.refresh} />
    </PageColumn>
  ) : isEmpty ? (
    <PageColumn>
      <LensEmptyState
        tone={CONCEPT_TONE.diff}
        icon={CONCEPT_ICONS.diff}
        title={emptyTitle(diff.view, baseBranch)}
        description={emptyBlurb(diff.view, baseBranch)}
      />
    </PageColumn>
  ) : (
    <DiffView
      files={diff.files}
      comments={comments}
      viewed={diff.viewed}
      fileActions={fileActions}
      focusPath={diff.focusPath}
      onFocusHandled={diff.clearFocus}
      toolbarEnd={
        openNotes.length > 0 ? (
          <DiffNotesActions sessionId={sessionId} openNotes={openNotes} />
        ) : undefined
      }
    />
  );

  return (
    <PaneShell title={DIFF_PANE_TITLE} meta={meta} actions={actions} tabs={toolbar} scroll="self">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {notices}
        {body}
      </div>
    </PaneShell>
  );
};
