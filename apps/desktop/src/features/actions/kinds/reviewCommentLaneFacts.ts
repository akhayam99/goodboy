import type { SessionId } from '@goodboy/types';
import type { ResolveQueueRow } from '../../resolve/buildResolveQueueRows';
import { laneAcceptCountOf, laneAcceptNotesOf } from '../../resolve/laneAcceptCount';
import type { AppStore } from '../../../store/store';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly row: ResolveQueueRow;
};

type ReviewCommentLaneFacts = {
  readonly hasFixOnBranch: boolean;
  readonly laneAcceptCount: number;
  readonly laneAcceptNotes: number;
};

export const reviewCommentLaneFactsOf = ({
  state,
  sessionId,
  row,
}: Params): ReviewCommentLaneFacts => {
  const candidates = state.sessionResolveCandidates[sessionId] ?? [];
  return {
    hasFixOnBranch:
      row.thread.disposition === 'fix' &&
      (row.thread.commitShas?.length ?? 0) > 0 &&
      !candidates.some(
        (entry) =>
          entry.candidate.state === 'ready' &&
          entry.items.some((member) => member.queueItemId === row.item.id),
      ),
    laneAcceptCount: laneAcceptCountOf({ candidates, itemId: row.item.id }),
    laneAcceptNotes: laneAcceptNotesOf({
      candidates,
      itemId: row.item.id,
      noteItemIds: new Set(
        (state.sessionResolveQueueItems[sessionId] ?? [])
          .filter((entry) => entry.thread.originKind === 'diff_comment')
          .map((entry) => entry.item.id),
      ),
    }),
  };
};
