import { useMemo, useState } from 'react';
import { groupsInViewOf } from '../../../commentGroupsView';
import { heldReviewGroupsOf, type HeldReviewPlaces } from '../../../heldReviewGroupsOf';
import type { CommentScope, CommentState } from '../ReviewScopeBar';
import type { ReviewGroup } from '../useReviewEntries';

type Params = {
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly scope: CommentScope;
  readonly state: CommentState;
};

const NONE: HeldReviewPlaces = new Map();

export const useHeldReviewGroups = ({
  groups,
  scope,
  state,
}: Params): ReadonlyArray<ReviewGroup> => {
  const [held, setHeld] = useState<HeldReviewPlaces>(
    () => heldReviewGroupsOf({ held: NONE, groups }).held,
  );
  const next = useMemo(() => heldReviewGroupsOf({ held, groups }), [held, groups]);
  if (next.held !== held) {
    setHeld(next.held);
  }
  return useMemo(
    () => groupsInViewOf({ groups: next.groups, scope, state }),
    [next.groups, scope, state],
  );
};
