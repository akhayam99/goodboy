import { useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn, ErrorStrip, PageColumn } from '@goodboy/ui';
import type { FileDiff, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { DiffViewSelector } from '../DiffViewSelector';
import { useDiffKeys } from '../../hooks/useDiffKeys';
import { useFileRail } from '../../hooks/useFileRail';
import { useDiffFileActions } from '../../hooks/useDiffFileActions';
import { useFilesReading } from '../../hooks/useFilesReading';
import { useReviewState } from '../../hooks/useReviewState';
import type { SessionDiff } from '../../hooks/useSessionDiff';
import { useTreeFilter } from '../../hooks/useTreeFilter';
import { useTreeFocus } from '../../hooks/useTreeFocus';
import { DiffRailContext } from '../../diffRailHost';
import { nextUnviewedPath } from '../../lib/fileOrder';
import { ChangeTree } from '../ChangeTree';
import { AllFilesTree } from '../ChangeTree/AllFilesTree';
import { ModeControl } from '../ChangeTree/ModeControl';
import { TreeLoading } from '../ChangeTree/TreeLoading';
import { FileRail } from '../FileRail';
import { FileReader } from '../FileReader';
import type { PeekOpenParams } from '../IdentifierPeek/PeekHost';
import { DiffView } from '../DiffView';
import type { FilesFact } from '../../filesFact';
import { AllFilesEmpty } from './AllFilesEmpty';
import { BranchCommitsNotice } from './BranchCommitsNotice';
import { ChangesScopePill } from './ChangesScopePill';
import { DiffEmptyState } from './DiffEmptyState';
import { DiffLoadingBody } from './DiffLoadingBody';
import { FilesToggle } from './FilesToggle';
import { NoFilesMatch } from './NoFilesMatch';

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
  const filter = useTreeFilter({ review });
  const reading = useFilesReading({
    sessionId,
    worktreePath,
    review,
    dismissTree: panel.dismiss,
  });
  const { isAll, openFile, pickFile } = reading;
  const isReading = openFile !== null;

  useDiffKeys({
    enabled: hasTree,
    review,
    onFocusTree: panel.focus,
    onFocusFilter: panel.focusFilter,
  });

  const openDrawer = useAppStore((s) => s.openDrawer);

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
  const selector = (
    <>
      <ChangesScopePill sessionId={sessionId} worktreePath={worktreePath} />
      {rail.isShown || !hasTree ? null : <FilesToggle fact={filesHead} onOpen={panel.focus} />}
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
    diff.metaError === null ? null : <BranchCommitsNotice error={diff.metaError} />;

  const body = diff.loading ? (
    <DiffLoadingBody />
  ) : diff.error !== null ? (
    <PageColumn>
      <ErrorStrip label="the diff" error={new Error(diff.error)} onRetry={diff.refresh} />
    </PageColumn>
  ) : isEmpty && isAll ? (
    <AllFilesEmpty baseBranch={baseBranch} selector={selector} />
  ) : isEmpty ? (
    <DiffEmptyState
      view={diff.view}
      baseBranch={baseBranch}
      alternate={diff.alternate}
      onChange={diff.setView}
      selector={selector}
      onShowAllFiles={() => reading.selectMode('all')}
    />
  ) : isFilteredOut ? (
    <NoFilesMatch onClear={review.clearFilters} />
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
      modeControl={
        <ModeControl
          mode={isAll ? 'all' : 'changed'}
          onMode={reading.selectMode}
          count={filesTotal}
          fact={filesHead}
        />
      }
      listSlot={
        isAll
          ? ({ hasDelta }) => (
              <AllFilesTree
                key={worktreePath}
                sessionDir={worktreePath}
                files={review.allFiles}
                query={review.query}
                activePath={openFile?.relPath ?? review.activePath}
                expanded={reading.expanded}
                onSetExpanded={reading.setFolderExpanded}
                stateOf={review.viewed.stateOf}
                onPickChanged={pickFile}
                onPickUnchanged={reading.pickUnchanged}
                hasDelta={hasDelta}
              />
            )
          : undefined
      }
    />
  );

  const railContent = diff.loading ? (
    <TreeLoading />
  ) : hasTree || (isAll && diff.error === null) ? (
    tree
  ) : null;
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
        {isReading || !(showsDiff || isEmpty) ? (
          <PageColumn className="flex min-w-0 items-center gap-2 pb-3">{selector}</PageColumn>
        ) : null}
        {metaNotice}
        <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', isReading && 'hidden')}>
          {body}
        </div>
        {openFile === null ? null : (
          <FileReader
            key={`${worktreePath}:${openFile.relPath}`}
            sessionId={sessionId}
            sessionDir={worktreePath}
            entry={openFile}
            baseBranch={baseBranch ?? 'its base branch'}
            onBack={reading.backToChanges}
          />
        )}
      </div>
      {railNode === null
        ? null
        : slots.slot === null
          ? railNode
          : createPortal(railNode, slots.slot)}
    </div>
  );
};
