import { useCallback, useRef } from 'react';
import type { FileDiff } from '@goodboy/types';
import type { FilesReading } from '../../hooks/useFilesReading';
import type { ReviewState } from '../../hooks/useReviewState';
import { useTreeFilter } from '../../hooks/useTreeFilter';
import { ChangeTree } from '../ChangeTree';
import { AllFilesTree } from '../ChangeTree/AllFilesTree';
import type { DiffFileActions } from '../DiffView/types';

type Props = {
  readonly review: ReviewState;
  readonly reading: FilesReading;
  readonly worktreePath: string;
  readonly total: number;
  readonly isReadOnly: boolean;
  readonly fileActions: DiffFileActions | null;
  readonly onLeave: () => void;
};

export const ChangesRail = ({
  review,
  reading,
  worktreePath,
  total,
  isReadOnly,
  fileActions,
  onLeave,
}: Props) => {
  const filterRef = useRef<HTMLInputElement | null>(null);
  const filter = useTreeFilter({ review });
  const { viewed } = review;
  const toggleViewed = useCallback(
    (file: FileDiff) => viewed.onToggle(file, viewed.stateOf(file) !== 'viewed'),
    [viewed],
  );
  return (
    <ChangeTree
      tree={review.tree}
      allFiles={review.allFiles}
      total={total}
      filter={filter}
      filterRef={filterRef}
      activePath={review.activePath}
      collapsed={review.collapsed}
      onToggleFolder={review.toggleFolder}
      onPick={reading.pickFile}
      stateOf={viewed.stateOf}
      commentCountOf={review.commentCountOf}
      kindsOf={review.kindsOf}
      isReadOnly={isReadOnly}
      onToggleViewed={toggleViewed}
      fileActions={fileActions}
      onLeave={onLeave}
      listSlot={
        reading.isAll
          ? ({ hasDelta }) => (
              <AllFilesTree
                key={worktreePath}
                sessionDir={worktreePath}
                files={review.allFiles}
                query={review.query}
                activePath={reading.openFile?.relPath ?? review.activePath}
                expanded={reading.expanded}
                onSetExpanded={reading.setFolderExpanded}
                stateOf={viewed.stateOf}
                onPickChanged={reading.pickFile}
                onPickUnchanged={reading.pickUnchanged}
                hasDelta={hasDelta}
              />
            )
          : undefined
      }
    />
  );
};
