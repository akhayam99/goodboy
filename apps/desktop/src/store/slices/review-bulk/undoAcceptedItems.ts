import type { SessionId } from '@goodboy/types';
import { isUndoableAccept } from '../../../features/resolve/bulkAccept';
import { launchRowsOf } from '../../../features/resolve/reviewRows';
import type { GetFn } from '../../slice-types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly itemIds: ReadonlyArray<string>;
};

export const undoAcceptedItems = async ({ get, sessionId, itemIds }: Params): Promise<boolean> => {
  let undone = 0;
  for (const itemId of [...itemIds].reverse()) {
    const row = launchRowsOf({ state: get(), sessionId }).find(
      (candidate) => candidate.item.id === itemId,
    );
    if (row === undefined || !isUndoableAccept({ row })) {
      continue;
    }
    await get().reopenResolveQueueItem({ sessionId, itemId, revision: row.thread.revision });
    undone += 1;
  }
  return undone > 0;
};
