import { laneChainOf } from '../../store/slices/resolve/resolveLane';
import type { ResolveCandidateWithItems } from '../../store/slices/resolve/state';

type Params = {
  readonly candidates: ReadonlyArray<ResolveCandidateWithItems>;
  readonly itemId: string;
};

const chainUpToItem = ({
  candidates,
  itemId,
}: Params): ReadonlyArray<ResolveCandidateWithItems> => {
  const own = candidates.find(
    (entry) =>
      entry.candidate.state === 'ready' &&
      entry.items.some((member) => member.queueItemId === itemId),
  );
  if (own === undefined) {
    return [];
  }
  const { chain } = laneChainOf({
    candidates,
    worktreePath: own.candidate.worktreePath,
  });
  const position = chain.findIndex((link) => link.candidate.id === own.candidate.id);
  return position < 0 ? [] : chain.slice(0, position + 1);
};

export const laneAcceptCountOf = ({ candidates, itemId }: Params): number =>
  Math.max(1, chainUpToItem({ candidates, itemId }).length);

export const laneAcceptNotesOf = ({
  candidates,
  itemId,
  noteItemIds,
}: Params & { readonly noteItemIds: ReadonlySet<string> }): number =>
  chainUpToItem({ candidates, itemId })
    .flatMap((link) => link.items)
    .filter((member) => noteItemIds.has(member.queueItemId)).length;
