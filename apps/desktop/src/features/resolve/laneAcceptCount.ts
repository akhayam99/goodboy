import { laneChainOf } from '../../store/slices/resolve/resolveLane';
import type { ResolveCandidateWithItems } from '../../store/slices/resolve/state';

export const laneAcceptCountOf = ({
  candidates,
  itemId,
}: {
  readonly candidates: ReadonlyArray<ResolveCandidateWithItems>;
  readonly itemId: string;
}): number => {
  const own = candidates.find(
    (entry) =>
      entry.candidate.state === 'ready' &&
      entry.items.some((member) => member.queueItemId === itemId),
  );
  if (own === undefined) {
    return 1;
  }
  const { chain } = laneChainOf({
    candidates,
    worktreePath: own.candidate.worktreePath,
  });
  const position = chain.findIndex((link) => link.candidate.id === own.candidate.id);
  return position < 0 ? 1 : position + 1;
};
