import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { failingChecksOf } from '../../../../branch/checks/failingChecksOf';
import { hasOpenRebaseStopOf } from '../../../../branch/hasOpenRebaseStopOf';
import type { BoardRow } from '../../../central/board/boardTypes';
import { branchRowOf, type BranchRow } from '../../../central/board/branchRowOf';
import type { BranchEntry } from '../../../central/branches/branchStoryOf';
import type { ActionCardModel } from '../../../central/next/actionCardsOf';
import { useOverlapCaution } from '../useOverlapCaution';

type Params = {
  readonly sessionId: SessionId;
  readonly row: BoardRow | undefined;
  readonly entry: BranchEntry | null;
  readonly runningCount: number;
  readonly cards: ReadonlyArray<Pick<ActionCardModel, 'kind'>>;
  readonly shownAskIds: ReadonlySet<string>;
  readonly isPermissionShown: boolean;
};

export const useBranchRow = ({
  sessionId,
  row,
  entry,
  runningCount,
  cards,
  shownAskIds,
  isPermissionShown,
}: Params): BranchRow | null => {
  const mountId = entry === null ? null : brandId<MountId>({ value: entry.fact.mountId });
  const failingCheckName = useAppStore((state) =>
    mountId === null ||
    entry === null ||
    entry.story.state !== 'checks-failing' ||
    entry.fact.request === null
      ? null
      : (failingChecksOf({
          state,
          sessionId,
          mountId,
          prNumber: entry.fact.request.number,
        })?.checks[0]?.name ?? null),
  );
  const isRebaseStopped = useAppStore((state) =>
    mountId === null ? false : hasOpenRebaseStopOf({ state, sessionId, mountId }),
  );
  const caution = useOverlapCaution({ mountId, isSettled: row?.isSettled === true });
  if (row === undefined) {
    return null;
  }
  return branchRowOf({
    row,
    entry,
    runningCount,
    cards,
    shownAskIds,
    isPermissionShown,
    isRebaseStopped,
    failingCheckName,
    overlap:
      caution === null ? null : { fileCount: caution.fileCount, otherName: caution.otherBranch },
  });
};
