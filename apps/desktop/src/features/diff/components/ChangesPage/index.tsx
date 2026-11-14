import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn, PageColumn, StudioRailLayout, useStudioRailFold } from '@goodboy/ui';
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
  readonly railSlot?: Readonly<{ host: HTMLElement; pane: HTMLElement; isShown: boolean }> | null;
};

const RAIL_MAX_PX = 560;

const FRAME_FOLD_BELOW_PX = 1060;

type LayoutParams = {
  readonly shown: ReactNode;
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
  railSlot = null,
}: Props) => {
  const review = useReviewState({ sessionId, worktreePath, diff });
  const baseBranch = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );
  const fold = useStudioRailFold({
    surface: CHANGES_RAIL_SURFACE,
    pane: railSlot?.pane ?? null,
    ...(railSlot !== null && { foldBelow: FRAME_FOLD_BELOW_PX }),
  });
  const { setFolded, canDock } = fold;
  const isFramed = railSlot !== null;
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
        <div className={cn('shrink-0 pb-2 empty:hidden', !isFramed && 'pl-4 pr-6')}>{notice}</div>
      )}
      {diff.metaError === null ? null : <BranchCommitsNotice error={diff.metaError} />}
    </>
  );
  const ownToolbar = isFramed ? (
    <PageColumn width="column" className="flex shrink-0 flex-col gap-3 pb-3">
      <ToolbarRow start={selector} end={end} isRow={false} />
      {belowToolbar}
    </PageColumn>
  ) : (
    <>
      <ToolbarRow start={selector} end={end} isRow />
      {belowToolbar}
    </>
  );
  const plainBody = (
    <ChangesPlainBody
      diff={diff}
      baseBranch={baseBranch}
      isAll={isAll}
      onShowAllFiles={() => reading.selectMode('all')}
      onClearFilters={review.clearFilters}
    />
  );

  const isDiffShown = hasTree && !isFilteredOut;
  const fileReader =
    openFile === null ? null : (
      <FileReader
        key={`${worktreePath}:${openFile.relPath}`}
        sessionId={sessionId}
        sessionDir={worktreePath}
        entry={openFile}
        baseBranch={baseBranch ?? 'its base branch'}
        onBack={reading.backToChanges}
      />
    );

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
            presentation={isFramed ? 'pane' : 'split'}
            identifierPeek={identifierPeek}
            toolbarStart={selector}
            toolbarEnd={end}
            belowToolbar={belowToolbar}
          />
        ) : isFramed ? (
          <PageColumn width="column">{plainBody}</PageColumn>
        ) : (
          plainBody
        )}
      </div>
      {openFile === null ? null : isFramed ? (
        <PageColumn width="column" className="flex min-h-0 flex-1 flex-col">
          {fileReader}
        </PageColumn>
      ) : (
        fileReader
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

  const layoutOf = ({ shown }: LayoutParams) => (
    <StudioRailLayout
      railLabel="Files"
      railWidth={railSlot === null ? 'standard' : 'wide'}
      {...(railSlot !== null && { max: RAIL_MAX_PX })}
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
      detail={shown}
    />
  );

  if (railSlot !== null) {
    return (
      <div
        ref={fold.paneRef}
        data-changes-page=""
        data-rail-place="frame"
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {railSlot.isShown
          ? createPortal(
              <div data-changes-rail="" className="flex h-full min-h-0 border-r border-border-soft">
                {layoutOf({ shown: null })}
              </div>,
              railSlot.host,
            )
          : null}
        {detail}
      </div>
    );
  }

  return (
    <div
      ref={fold.paneRef}
      data-changes-page=""
      className="flex min-h-0 min-w-0 flex-1 flex-col pl-4 @max-[720px]:pl-2"
    >
      {layoutOf({ shown: detail })}
    </div>
  );
};
