import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';
import { classifyAgent } from '../../agent-kind';
import type { FollowUpKind } from './followUpMoves';

export type FollowUpChild = Readonly<{
  child: SpawnedChild;
  kind: FollowUpKind;
}>;

type Params = {
  readonly spawned: ReadonlyArray<SpawnedChild>;
  readonly kinds: ReadonlyArray<FollowUpKind>;
};

export const selectFollowUpChildren = ({
  spawned,
  kinds,
}: Params): ReadonlyArray<FollowUpChild> => {
  const matched: Array<FollowUpChild> = [];
  for (const child of spawned) {
    const classified = classifyAgent(child.agent, null);
    const kind = kinds.find((candidate) => candidate === classified);
    if (kind === undefined) {
      continue;
    }
    matched.push({ child, kind });
  }
  return matched;
};
