import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { PencilLine } from 'lucide-react';
import { Button, ErrorStrip, LensEmptyState, PageColumn, Skeleton, formatError } from '@goodboy/ui';
import type { DiffView as DiffViewKind, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openFileInWorkspace } from '../../../../shared/lib/editor';
import { resolveEditorBinary } from '../../../../shared/lib/editorSettings';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { DiffViewSelector } from '../../../permissions/components/DiffViewSelector';
import { useReviewState } from '../../hooks/useReviewState';
import type { SessionDiff } from '../../hooks/useSessionDiff';
import { ChangeTree } from '../ChangeTree';
import { DiffView } from '../DiffView';

type Props = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly worktreePath: string;
  readonly diff: SessionDiff;
  readonly onWriteReview: (() => void) | null;
  readonly toolbarExtra?: ReactNode;
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
  diff,
  onWriteReview,
  toolbarExtra = null,
}: Props) => {
  const review = useReviewState({ sessionId, worktreePath, diff });
  const editorBinary = useAppStore((s) => resolveEditorBinary({ settings: s.settings }));
  const emitNotification = useAppStore((s) => s.emitNotification);
  const baseBranch = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );

  const filterRef = useRef<HTMLInputElement | null>(null);
  useShortcut('diff.focusFilter', () => filterRef.current?.focus());

  const isEmpty = !diff.loading && diff.error === null && diff.files.length === 0;
  const hasTree = !diff.loading && diff.error === null && diff.files.length > 0;
  const isFilteredOut = hasTree && review.tree.files.length === 0;
  const filter = useMemo(
    () => ({
      query: review.query,
      onQuery: review.setQuery,
      unviewedOnly: review.unviewedOnly,
      onUnviewedOnly: review.setUnviewedOnly,
      notesOnly: review.notesOnly,
      onNotesOnly: review.setNotesOnly,
      group: review.group,
      onGroup: review.setGroup,
      isFiltering: review.isFiltering,
      onClear: review.clearFilters,
    }),
    [
      review.clearFilters,
      review.group,
      review.isFiltering,
      review.notesOnly,
      review.query,
      review.setGroup,
      review.setNotesOnly,
      review.setQuery,
      review.setUnviewedOnly,
      review.unviewedOnly,
    ],
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

  const selector = (
    <PageColumn className="flex min-w-0 items-center gap-2 pb-3">
      <DiffViewSelector
        view={diff.view}
        onChange={diff.setView}
        commits={diff.commits}
        status={diff.status}
        filesCount={diff.loading || diff.error !== null ? null : diff.files.length}
        loading={diff.loading}
      />
      {diff.loading || diff.error !== null ? null : (
        <span className="flex items-center gap-1 text-meta tabular-nums text-muted-foreground">
          <span>
            {diff.files.length} {diff.files.length === 1 ? 'file' : 'files'}
          </span>
          <span className="text-success">+{totals.adds}</span>
          <span className="text-danger">−{totals.dels}</span>
        </span>
      )}
    </PageColumn>
  );

  const metaNotice =
    diff.metaError === null ? null : (
      <PageColumn className="pb-2">
        <p role="status" className="text-meta text-muted-foreground" title={diff.metaError}>
          Couldn't read this branch's commits.
        </p>
      </PageColumn>
    );

  const body = diff.loading ? (
    <PageColumn className="flex flex-col gap-3">
      {[0, 1].map((index) => (
        <div key={index} className="flex flex-col gap-2">
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
  ) : isFilteredOut ? (
    <PageColumn>
      <LensEmptyState
        tone={CONCEPT_TONE.diff}
        icon={CONCEPT_ICONS.diff}
        title="No files match"
        description="Nothing in this diff matches the current filter."
        action={
          <Button size="sm" variant="secondary" onClick={review.clearFilters}>
            Clear
          </Button>
        }
      />
    </PageColumn>
  ) : (
    <DiffView
      files={review.tree.files}
      comments={review.comments}
      viewed={review.viewed}
      fileActions={fileActions}
      focusPath={diff.focusPath}
      onFocusHandled={diff.clearFocus}
      onActivePathChange={review.setActivePath}
      toolbarEnd={
        onWriteReview === null && toolbarExtra === null ? undefined : (
          <>
            {toolbarExtra}
            {onWriteReview === null ? null : (
              <Button size="sm" variant="secondary" onClick={onWriteReview}>
                <PencilLine size={ICON_SIZE.row} aria-hidden />
                Write review
              </Button>
            )}
          </>
        )
      }
    />
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {hasTree && (
        <aside aria-label="Files" className="hidden min-h-0 w-[280px] shrink-0 pl-3 @4xl:flex">
          <ChangeTree
            tree={review.tree}
            allFiles={review.allFiles}
            filter={filter}
            filterRef={filterRef}
            activePath={review.activePath}
            collapsed={review.collapsed}
            onToggleFolder={review.toggleFolder}
            onPick={review.jumpTo}
            stateOf={review.viewed.stateOf}
            noteCountOf={review.noteCountOf}
          />
        </aside>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selector}
        {metaNotice}
        {body}
      </div>
    </div>
  );
};
