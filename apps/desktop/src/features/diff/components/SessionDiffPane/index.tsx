import { useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PencilLine } from 'lucide-react';
import { Button, ErrorStrip, EmptyState, PageColumn, Skeleton, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { reviewNotesDrawer } from '../../../resolve/notes/notesDrawer';
import { openFileInWorkspace } from '../../../../shared/lib/editor';
import { resolveEditorBinary } from '../../../../shared/lib/editorSettings';
import { DiffViewSelector } from '../../../permissions/components/DiffViewSelector';
import { useDiffKeys } from '../../hooks/useDiffKeys';
import { useReviewState } from '../../hooks/useReviewState';
import type { SessionDiff } from '../../hooks/useSessionDiff';
import { useTreePanel } from '../../hooks/useTreePanel';
import { DiffRailContext } from '../../diffRailContext';
import { ChangeTree } from '../ChangeTree';
import { TreeFilesButton } from '../ChangeTree/TreeFilesButton';
import { TreeLoading } from '../ChangeTree/TreeLoading';
import { TreeRail } from '../ChangeTree/TreeRail';
import { TreeResizer } from '../ChangeTree/TreeResizer';
import { TreeStrip } from '../ChangeTree/TreeStrip';
import { DiffView } from '../DiffView';
import { DiffEmptyState } from './DiffEmptyState';

type Props = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly worktreePath: string;
  readonly diff: SessionDiff;
  readonly onWriteReview: (() => void) | null;
  readonly toolbarExtra?: ReactNode;
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
  const rail = useContext(DiffRailContext);
  const panel = useTreePanel({ mode: rail.mode });

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

  useDiffKeys({
    enabled: hasTree,
    review,
    onToggleTree: panel.toggle,
    onFocusTree: panel.focus,
    onFocusFilter: panel.focusFilter,
  });

  const viewedCount = useMemo(
    () => review.allFiles.filter((file) => review.viewed.stateOf(file) === 'viewed').length,
    [review.allFiles, review.viewed],
  );

  const commentOnFile = useCallback(
    (path: string) => {
      review.commentOnFile(path);
      panel.dismiss();
    },
    [panel, review],
  );

  const openDrawer = useAppStore((s) => s.openDrawer);
  const openNotes = useCallback(
    (path: string) => {
      openDrawer(reviewNotesDrawer({ sessionId, mountPath: worktreePath, focusPath: path }));
      panel.dismiss();
    },
    [openDrawer, panel, sessionId, worktreePath],
  );

  const pickFile = useCallback(
    (path: string) => {
      review.jumpTo(path);
      panel.dismiss();
    },
    [panel, review],
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

  const selector = (
    <DiffViewSelector
      view={diff.view}
      onChange={diff.setView}
      commits={diff.commits}
      status={diff.status}
      baseBranch={baseBranch}
      branch={diff.status?.branch ?? null}
      loading={diff.loading}
    />
  );
  const showsDiff = !diff.loading && diff.error === null && !isEmpty && !isFilteredOut;
  const showsButton = hasTree && rail.mode === 'button';
  const filesButton = showsButton ? (
    <TreeFilesButton
      triggerRef={panel.triggerRef}
      viewed={viewedCount}
      total={review.allFiles.length}
      isOpen={panel.isOpen}
      onToggle={panel.toggle}
    />
  ) : null;

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
    <DiffEmptyState
      view={diff.view}
      baseBranch={baseBranch}
      alternate={diff.alternate}
      onChange={diff.setView}
      selector={selector}
    />
  ) : isFilteredOut ? (
    <PageColumn>
      <EmptyState
        size="section"
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
      registerScroller={review.registerScroller}
      onActivePathChange={review.setActivePath}
      fileCommentPath={review.fileCommentPath}
      onFileCommentOpened={review.clearFileComment}
      columnWidth="full"
      toolbarStart={
        <>
          {filesButton}
          {selector}
        </>
      }
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

  const tree = (
    <ChangeTree
      tree={review.tree}
      allFiles={review.allFiles}
      filter={filter}
      filterRef={filterRef}
      activePath={review.activePath}
      collapsed={review.collapsed}
      onToggleFolder={review.toggleFolder}
      onPick={pickFile}
      onCommentOnFile={review.comments.allowFileLevel ? commentOnFile : null}
      onOpenNotes={openNotes}
      hasNotesIn={review.hasNotesIn}
      stateOf={review.viewed.stateOf}
      noteCountOf={review.noteCountOf}
    />
  );

  const treeColumn = diff.loading ? <TreeLoading /> : hasTree ? tree : null;

  const isDockedMode = rail.mode === 'docked';
  const showsRail = isDockedMode && treeColumn !== null && (panel.isOpen || !hasTree);
  const showsStrip = hasTree && (rail.mode === 'strip' || (isDockedMode && !panel.isOpen));
  const showsOverlay = hasTree && !isDockedMode && panel.isOpen;

  const railNodes = (
    <>
      {showsRail && (
        <TreeRail
          variant="docked"
          asideRef={panel.asideRef}
          width={rail.width}
          count={hasTree ? review.allFiles.length : null}
          isAfterStrip={false}
          onFold={hasTree ? panel.fold : null}
          resizer={
            hasTree ? (
              <TreeResizer
                asideRef={panel.asideRef}
                width={rail.width}
                paneWidth={rail.paneWidth}
                onResize={rail.resizeTo}
              />
            ) : null
          }
        >
          {treeColumn}
        </TreeRail>
      )}
      {showsStrip && (
        <TreeStrip
          ref={panel.triggerRef}
          viewed={viewedCount}
          total={review.allFiles.length}
          isOpen={panel.isOpen}
          onToggle={panel.toggle}
        />
      )}
      {showsOverlay && (
        <TreeRail
          variant="overlay"
          asideRef={panel.asideRef}
          width={rail.width}
          count={review.allFiles.length}
          isAfterStrip={rail.mode === 'strip'}
          onFold={panel.fold}
        >
          {tree}
        </TreeRail>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {rail.host === null ? null : createPortal(railNodes, rail.host)}
      {showsDiff || isEmpty ? null : (
        <PageColumn className="flex min-w-0 items-center gap-2 pb-3">
          {filesButton}
          {selector}
        </PageColumn>
      )}
      {metaNotice}
      {body}
    </div>
  );
};
