import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { AlertTriangle, Copy, ExternalLink, GitBranch, RefreshCw } from 'lucide-react';
import {
  Button,
  ErrorStrip,
  LensEmptyState,
  OverflowMenu,
  PageColumn,
  Skeleton,
  formatError,
  type OverflowMenuItem,
} from '@goodboy/ui';
import type { DiffView as DiffViewKind, SessionId } from '@goodboy/types';
import { useAppStore, type DiffFocus } from '../../../../store';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openFileInWorkspace } from '../../../../shared/lib/editor';
import { distanceAhead, distanceBehind } from '../../../../shared/lib/gitStatus';
import {
  DEFAULT_EDITOR_BINARY,
  SETTING_DEFAULT_EDITOR,
  SETTING_EDITOR_BINARY,
} from '../../../settings/settings';
import { useRebaseAgent } from '../../../session/hooks/useRebaseAgent';
import { DiffViewSelector } from '../../../permissions/components/DiffViewSelector';
import { ResolveOverviewAction } from '../../../resolve/components/ResolveOverviewAction';
import { useDiffNotes } from '../../hooks/useDiffNotes';
import { useSessionDiff } from '../../hooks/useSessionDiff';
import { DiffView } from '../DiffView';
import { DiffNotesDock } from '../DiffNotesDock';

export const DIFF_PANE_TITLE = 'Diff';

type Props = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly worktreePath: string;
  readonly diffFocus: DiffFocus | null;
  readonly branchRevision: number;
  readonly headerActions?: ReactNode;
  readonly aboveBody?: ReactNode;
  readonly onContentEmptyChange?: (isEmpty: boolean) => void;
};

const emptyTitle = (view: DiffViewKind): string => {
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
  return 'Branch matches main';
};

const emptyBlurb = (view: DiffViewKind): string => {
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
  return 'Every commit on this branch is already reachable from main, nothing extra to review.';
};

export const SessionDiffPane = ({
  sessionId,
  workingDir,
  worktreePath,
  diffFocus,
  branchRevision,
  headerActions,
  aboveBody,
  onContentEmptyChange,
}: Props) => {
  const diff = useSessionDiff({ sessionId, worktreePath, diffFocus, branchRevision });
  const { comments, openNotes } = useDiffNotes({ sessionId });
  const mountId = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.mountId ?? null,
  );
  const rebase = useRebaseAgent({ sessionId, mountId, status: diff.status });
  const editorBinary = useAppStore(
    (s) =>
      s.settings[SETTING_DEFAULT_EDITOR] ??
      s.settings[SETTING_EDITOR_BINARY] ??
      DEFAULT_EDITOR_BINARY,
  );
  const emitNotification = useAppStore((s) => s.emitNotification);

  const isEmpty = !diff.loading && diff.error === null && diff.files.length === 0;
  useEffect(() => {
    onContentEmptyChange?.(diff.error === null && diff.files.length === 0);
  }, [diff.error, diff.files.length, onContentEmptyChange]);

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

  const meta =
    diff.loading || diff.error !== null ? null : (
      <span className="flex flex-wrap items-center gap-1.5">
        <span>
          {diff.files.length} {diff.files.length === 1 ? 'file' : 'files'}
        </span>
        <span aria-hidden>·</span>
        <span className="text-success">+{totals.adds}</span>
        <span className="text-danger">−{totals.dels}</span>
        {ahead !== null ? (
          <>
            <span aria-hidden>·</span>
            <span>
              {ahead} {ahead === 1 ? 'commit' : 'commits'}
            </span>
          </>
        ) : null}
        {behind !== null && behind > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle size={10} aria-hidden />
              behind main by {behind}
            </span>
          </>
        ) : null}
      </span>
    );

  const overflow: OverflowMenuItem[] = [
    {
      kind: 'item',
      key: 'refresh',
      label: 'Refresh',
      icon: RefreshCw,
      onClick: diff.refresh,
    },
    ...(fileActions !== null && diff.files.length > 0
      ? [
          {
            kind: 'item' as const,
            key: 'open-all',
            label: 'Open all in editor',
            icon: ExternalLink,
            onClick: () => {
              for (const file of diff.files) {
                void openInEditor(file.path);
              }
            },
          },
        ]
      : []),
    ...(diff.patch !== ''
      ? [
          {
            kind: 'item' as const,
            key: 'copy-patch',
            label: 'Copy patch',
            icon: Copy,
            onClick: () => void navigator.clipboard?.writeText(diff.patch),
          },
        ]
      : []),
  ];

  const actions = (
    <>
      {rebase.canRebase && mountId !== null && behind !== null && behind > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void rebase.run({ mountId })}
          disabled={rebase.isRunning}
          title={rebase.isRunning ? 'Rebase agent is still running' : 'Rebase onto main'}
        >
          <GitBranch size={ICON_SIZE.row} aria-hidden />
          Rebase
        </Button>
      ) : null}
      <ResolveOverviewAction sessionId={sessionId} />
      {headerActions}
      <DiffViewSelector
        view={diff.view}
        onChange={diff.setView}
        commits={diff.commits}
        status={diff.status}
        filesCount={diff.loading || diff.error !== null ? null : diff.files.length}
        loading={diff.loading}
      />
      <OverflowMenu items={overflow} label="More diff actions" align="right" />
    </>
  );

  const notices =
    rebase.error !== null || diff.metaError !== null ? (
      <PageColumn className="pb-2">
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
        title={emptyTitle(diff.view)}
        description={emptyBlurb(diff.view)}
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
    />
  );

  return (
    <PaneShell
      title={DIFF_PANE_TITLE}
      meta={meta}
      actions={actions}
      scroll="self"
      dock={
        openNotes.length > 0 && !isEmpty ? (
          <DiffNotesDock sessionId={sessionId} mountId={mountId} openNotes={openNotes} />
        ) : null
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {aboveBody}
        {notices}
        {body}
      </div>
    </PaneShell>
  );
};
