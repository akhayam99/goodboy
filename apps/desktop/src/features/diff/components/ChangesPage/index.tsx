import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn, StudioRailLayout, useStudioRailFold } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { DiffViewSelector } from '../DiffViewSelector';
import { useDiffKeys } from '../../hooks/useDiffKeys';
import { useDiffFileActions } from '../../hooks/useDiffFileActions';
import { useFilesReading } from '../../hooks/useFilesReading';
import { useReviewState } from '../../hooks/useReviewState';
import type { SessionDiff } from '../../hooks/useSessionDiff';
import { useTreeFocus } from '../../hooks/useTreeFocus';
import { nextUnviewedPath } from '../../lib/fileOrder';
import { viewedCountOf } from '../../lib/viewedCountOf';
import { ModeControl } from '../ChangeTree/ModeControl';
import { TreeLoading } from '../ChangeTree/TreeLoading';
import { FileReader } from '../FileReader';
import { DiffView } from '../DiffView';
import { ToolbarRow } from '../DiffView/ToolbarRow';
import type { FilesFact } from '../../filesFact';
import { CHANGES_RAIL_SURFACE } from '../../changesRailSurface';
import { useIdentifierPeek } from '../../hooks/useIdentifierPeek';
import { BranchCommitsNotice } from './BranchCommitsNotice';
import { ChangesPlainBody } from './ChangesPlainBody';
import { ChangesRail } from './ChangesRail';
import { ChangesScopePill } from './ChangesScopePill';
import { ReviewProgress } from './ReviewProgress';

type Props = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly worktreePath: string;
  readonly diff: SessionDiff;
  readonly isReadOnly?: boolean;
  readonly toolbarEnd?: ReactNode;
  readonly filesFact?: FilesFact;
  readonly commitTotal?: number | null;
  readonly notice?: ReactNode;
};

export const ChangesPage = ({
  sessionId,
  workingDir,
  worktreePath,
  diff,
  isReadOnly = false,
  toolbarEnd,
  filesFact,
  commitTotal = null,
  notice = null,
}: Props) => {
  const review = useReviewState({ sessionId, worktreePath, diff });
  const baseBranch = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );
  const fold = useStudioRailFold({ surface: CHANGES_RAIL_SURFACE });
  const { setFolded, canDock } = fold;
  const [railBody, setRailBody] = useState<HTMLDivElement | null>(null);
  const openRail = useCallback(() => setFolded(false), [setFolded]);
  const dismissRail = useCallback(() => {
    if (!canDock) {
      setFolded(true);
    }
  }, [canDock, setFolded]);
  const panel = useTreeFocus({ host: railBody, open: openRail, dismiss: dismissRail });

  const hasTree = !diff.loading && diff.error === null && diff.files.length > 0;
  const isFilteredOut = hasTree && review.tree.files.length === 0;
  const reading = useFilesReading({ sessionId, worktreePath, review, dismissTree: panel.dismiss });
  const { isAll, openFile, pickFile } = reading;
  const isReading = openFile !== null;

  useDiffKeys({
    enabled: hasTree,
    review,
    onFocusTree: panel.focus,
    onFocusFilter: panel.focusFilter,
  });

  const identifierPeek = useIdentifierPeek({
    sessionId,
    worktreePath,
    isCommitView: diff.view.kind === 'commit',
  });

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
  const viewedCount = useMemo(
    () => viewedCountOf({ files: review.allFiles, stateOf: review.viewed.stateOf }),
    [review.allFiles, review.viewed.stateOf],
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

  const selector = (
    <>
      <ChangesScopePill sessionId={sessionId} worktreePath={worktreePath} />
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
  const end = (
    <>
      {hasTree ? (
        <ReviewProgress viewedCount={viewedCount} total={filesTotal} onNext={nextUnviewed} />
      ) : null}
      {toolbarEnd}
    </>
  );
  const belowToolbar = (
    <>
      {notice === null ? null : (
        <div className="shrink-0 pb-2 pl-4 pr-6 empty:hidden">{notice}</div>
      )}
      {diff.metaError === null ? null : <BranchCommitsNotice error={diff.metaError} />}
    </>
  );
  const ownToolbar = (
    <>
      <ToolbarRow start={selector} end={end} isRow />
      {belowToolbar}
    </>
  );

  const isDiffShown = hasTree && !isFilteredOut;

  const detail = (
    <div data-changes-diff="" className="flex h-full min-h-0 min-w-0 flex-col">
      {isDiffShown && !isReading ? null : ownToolbar}
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', isReading && 'hidden')}>
        {isDiffShown ? (
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
            presentation="split"
            identifierPeek={identifierPeek}
            toolbarStart={selector}
            toolbarEnd={end}
            belowToolbar={belowToolbar}
          />
        ) : (
          <ChangesPlainBody
            diff={diff}
            baseBranch={baseBranch}
            isAll={isAll}
            onShowAllFiles={() => reading.selectMode('all')}
            onClearFilters={review.clearFilters}
          />
        )}
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
  );

  const railContent = diff.loading ? (
    <TreeLoading />
  ) : hasTree || (isAll && diff.error === null) ? (
    <ChangesRail
      review={review}
      reading={reading}
      worktreePath={worktreePath}
      total={filesTotal}
      isReadOnly={isReadOnly}
      fileActions={fileActions}
      onLeave={() => {
        if (review.activePath !== null) {
          review.focusFile(review.activePath);
        }
        panel.dismiss();
      }}
    />
  ) : null;

  return (
    <div
      ref={fold.paneRef}
      data-changes-page=""
      className="flex min-h-0 min-w-0 flex-1 flex-col pl-4 @max-[720px]:pl-2"
    >
      <StudioRailLayout
        railLabel="Files"
        railWidth="standard"
        surface={CHANGES_RAIL_SURFACE}
        placement="page"
        isCollapsed={fold.isCollapsed}
        onCollapsedChange={setFolded}
        railHeader={
          railContent === null || diff.loading ? null : (
            <ModeControl
              mode={isAll ? 'all' : 'changed'}
              onMode={reading.selectMode}
              count={filesTotal}
              fact={filesHead}
            />
          )
        }
        rail={
          railContent === null ? null : (
            <div ref={setRailBody} className="flex min-h-0 flex-1 flex-col">
              {railContent}
            </div>
          )
        }
        detail={detail}
      />
    </div>
  );
};
