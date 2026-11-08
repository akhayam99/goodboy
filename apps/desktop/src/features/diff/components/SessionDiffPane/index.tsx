import { useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PanelRightOpen } from 'lucide-react';
import {
  Button,
  EmptyState,
  ErrorStrip,
  ICON_SIZE,
  PageColumn,
  Skeleton,
  Tooltip,
} from '@goodboy/ui';
import type { FileDiff, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { DiffViewSelector } from '../DiffViewSelector';
import { useDiffKeys } from '../../hooks/useDiffKeys';
import { useFileRail } from '../../hooks/useFileRail';
import { useDiffFileActions } from '../../hooks/useDiffFileActions';
import { useReviewState } from '../../hooks/useReviewState';
import type { SessionDiff } from '../../hooks/useSessionDiff';
import { useTreeFocus } from '../../hooks/useTreeFocus';
import { DiffRailContext } from '../../diffRailHost';
import { nextUnviewedPath } from '../../lib/fileOrder';
import { ChangeTree } from '../ChangeTree';
import { FileRail } from '../FileRail';
import { TreeLoading } from '../ChangeTree/TreeLoading';
import type { PeekOpenParams } from '../IdentifierPeek/PeekHost';
import { DiffView } from '../DiffView';
import { DiffEmptyState } from './DiffEmptyState';
import { DiffStatText } from '../../../../shared/components/DiffStatText';
import type { FilesFact } from '../../filesFact';

type Props = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly worktreePath: string;
  readonly diff: SessionDiff;
  readonly isReadOnly?: boolean;
  readonly toolbarEnd?: ReactNode;
  readonly filesFact?: FilesFact;
  readonly commitTotal?: number | null;
};

export const SessionDiffPane = ({
  sessionId,
  workingDir,
  worktreePath,
  diff,
  isReadOnly = false,
  toolbarEnd,
  filesFact,
  commitTotal = null,
}: Props) => {
  const review = useReviewState({ sessionId, worktreePath, diff });
  const baseBranch = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );

  const filterRef = useRef<HTMLInputElement | null>(null);
  const slots = useContext(DiffRailContext);
  const [ownPage, setOwnPage] = useState<HTMLDivElement | null>(null);
  const [railBody, setRailBody] = useState<HTMLDivElement | null>(null);
  const rail = useFileRail({ page: slots.page ?? ownPage });
  const panel = useTreeFocus({
    host: rail.isShown ? railBody : null,
    open: rail.open,
    dismiss: rail.dismiss,
  });

  const isEmpty = !diff.loading && diff.error === null && diff.files.length === 0;
  const hasTree = !diff.loading && diff.error === null && diff.files.length > 0;
  const isFilteredOut = hasTree && review.tree.files.length === 0;
  const filter = useMemo(
    () => ({
      query: review.query,
      onQuery: review.setQuery,
      unviewedOnly: review.unviewedOnly,
      onUnviewedOnly: review.setUnviewedOnly,
      commentedOnly: review.commentedOnly,
      onCommentedOnly: review.setCommentedOnly,
      group: review.group,
      onGroup: review.setGroup,
      isFiltering: review.isFiltering,
      onClear: review.clearFilters,
    }),
    [
      review.clearFilters,
      review.group,
      review.isFiltering,
      review.commentedOnly,
      review.query,
      review.setCommentedOnly,
      review.setGroup,
      review.setQuery,
      review.setUnviewedOnly,
      review.unviewedOnly,
    ],
  );

  useDiffKeys({
    enabled: hasTree,
    review,
    onFocusTree: panel.focus,
    onFocusFilter: panel.focusFilter,
  });

  const openDrawer = useAppStore((s) => s.openDrawer);

  const pickFile = useCallback(
    (path: string) => {
      review.jumpTo(path);
      panel.dismiss();
    },
    [panel, review],
  );

  const isCommitView = diff.view.kind === 'commit';
  const identifierPeek = useMemo(
    () =>
      isCommitView
        ? null
        : {
            worktreePath,
            onOpen: ({ word, match }: PeekOpenParams) =>
              openDrawer({
                kind: 'identifier-peek',
                sessionId,
                payload: {
                  worktreePath,
                  word,
                  selected: { path: match.path, line: match.line },
                },
              }),
          },
    [isCommitView, openDrawer, sessionId, worktreePath],
  );

  const { fileActions, loadFileSides } = useDiffFileActions({
    sessionId,
    workingDir,
    worktreePath,
    view: diff.view,
    baseBranch,
  });

  const filesHead = filesFact ?? {
    text: String(review.allFiles.length),
    count: review.allFiles.length,
    diff: null,
  };
  const filesTotal = filesHead.count ?? review.allFiles.length;
  const filesToggle =
    rail.isShown || !hasTree ? null : (
      <Button size="sm" variant="quiet" onClick={panel.focus}>
        <PanelRightOpen size={ICON_SIZE.row} aria-hidden />
        Files
        <span className="flex items-center gap-1 tabular-nums text-faint-foreground">
          {filesHead.text}
          {filesHead.diff === null ? null : <DiffStatText diff={filesHead.diff} />}
        </span>
      </Button>
    );
  const selector = (
    <>
      {filesToggle}
      <DiffViewSelector
        view={diff.view}
        onChange={diff.setView}
        commits={diff.commits}
        status={diff.status}
        baseBranch={baseBranch}
        loading={diff.loading}
        commitTotal={commitTotal}
      />
    </>
  );
  const showsDiff = !diff.loading && diff.error === null && !isEmpty && !isFilteredOut;
  const metaNotice =
    diff.metaError === null ? null : (
      <PageColumn className="pb-2">
        <Tooltip content={diff.metaError}>
          <p role="status" className="text-meta text-muted-foreground">
            Couldn't read this branch's commits.
          </p>
        </Tooltip>
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
      bodies={diff.bodies}
      loadFileSides={loadFileSides}
      comments={review.comments}
      viewed={review.viewed}
      fileActions={fileActions}
      focusPath={diff.focusPath}
      focusThreadId={diff.focusThreadId}
      onFocusHandled={diff.clearFocus}
      registerScroller={review.registerScroller}
      registerFileFocus={review.registerFileFocus}
      onActivePathChange={review.setActivePath}
      isReadOnly={isReadOnly}
      columnWidth="full"
      identifierPeek={identifierPeek}
      toolbarStart={selector}
      toolbarEnd={toolbarEnd}
    />
  );

  const nextUnviewed = useCallback(() => {
    const target = nextUnviewedPath({
      files: review.tree.files,
      from: review.activePath,
      stateOf: review.viewed.stateOf,
      wrap: true,
    });
    if (target !== null) {
      pickFile(target);
    }
  }, [pickFile, review.activePath, review.tree.files, review.viewed.stateOf]);

  const leaveTree = useCallback(() => {
    if (review.activePath !== null) {
      review.focusFile(review.activePath);
    }
    panel.dismiss();
  }, [panel, review]);

  const toggleViewed = useCallback(
    (file: FileDiff) => review.viewed.onToggle(file, review.viewed.stateOf(file) !== 'viewed'),
    [review.viewed],
  );

  const tree = (
    <ChangeTree
      tree={review.tree}
      allFiles={review.allFiles}
      total={filesTotal}
      filter={filter}
      filterRef={filterRef}
      activePath={review.activePath}
      collapsed={review.collapsed}
      onToggleFolder={review.toggleFolder}
      onPick={pickFile}
      stateOf={review.viewed.stateOf}
      commentCountOf={review.commentCountOf}
      kindsOf={review.kindsOf}
      isReadOnly={isReadOnly}
      onToggleViewed={toggleViewed}
      fileActions={fileActions}
      onNextUnviewed={nextUnviewed}
      onLeave={leaveTree}
      onFold={rail.fold}
    />
  );

  const railContent = diff.loading ? <TreeLoading /> : hasTree ? tree : null;
  const railNode =
    railContent === null ? null : (
      <FileRail
        key={rail.isOverlay ? 'overlay' : 'docked'}
        isShown={rail.isShown}
        isOverlay={rail.isOverlay}
        frame={slots.page ?? ownPage}
        bodyRef={setRailBody}
      >
        {railContent}
      </FileRail>
    );

  return (
    <div ref={setOwnPage} data-diff-pane="" className="relative flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {showsDiff || isEmpty ? null : (
          <PageColumn className="flex min-w-0 items-center gap-2 pb-3">{selector}</PageColumn>
        )}
        {metaNotice}
        {body}
      </div>
      {railNode === null
        ? null
        : slots.slot === null
          ? railNode
          : createPortal(railNode, slots.slot)}
    </div>
  );
};
