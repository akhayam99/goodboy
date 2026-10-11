import { useMemo } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolveCandidateWithItems } from '../../../../store/slices/resolve/state';
import { selectResolveCandidate } from '../../selectResolveCandidate';
import { useResolveCandidateDiff } from '../../hooks/useResolveCandidateDiff';
import { OUTCOME_ACTION } from '../../commentOutcomeCopy';
import { ProposedChange } from '../ReviewFlow/ProposedChange';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { useOutcomeRun } from './useOutcomeRun';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
};

const NO_CANDIDATES: ReadonlyArray<ResolveCandidateWithItems> = [];

export const OutcomeFixProposed = ({ sessionId, entry }: Props) => {
  const candidates = useAppStore((s) => s.sessionResolveCandidates[sessionId] ?? NO_CANDIDATES);
  const acceptReviewComments = useAppStore((s) => s.acceptReviewComments);
  const deferResolveQueueItem = useAppStore((s) => s.deferResolveQueueItem);
  const { isBusy, error, run } = useOutcomeRun();
  const candidate = useMemo(
    () => selectResolveCandidate({ candidates, itemId: entry.row.item.id }),
    [candidates, entry.row.item.id],
  );
  const diff = useResolveCandidateDiff({ candidate });

  const apply = async (): Promise<void> => {
    const result = await acceptReviewComments({ sessionId, threadIds: [entry.threadId] });
    const [failure] = result.failures;
    if (failure !== undefined) {
      throw new Error(failure.message);
    }
  };

  const discard = async (): Promise<void> => {
    const { item } = entry.row;
    await deferResolveQueueItem({ sessionId, itemId: item.id });
    useAppStore.getState().undoable({
      message: OUTCOME_ACTION.discarded,
      conflictMessage: OUTCOME_ACTION.discardConflict,
      undo: async () => {
        await useAppStore.getState().takeUpResolveQueueItem({ sessionId, itemId: item.id });
        return true;
      },
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ProposedChange files={diff.files} isLoading={diff.isLoading} error={diff.error} isCompact />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" isBusy={isBusy} onClick={() => void run(apply)}>
          {OUTCOME_ACTION.applyFix}
        </Button>
        <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => void run(discard)}>
          {OUTCOME_ACTION.discard}
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
