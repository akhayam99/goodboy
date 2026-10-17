import type { ResolvedAction } from '../actions/types';

const RELATED_LIMIT = 2;

type Params = {
  readonly actions: ReadonlyArray<ResolvedAction>;
};

type RankParams = {
  readonly action: ResolvedAction;
};

const rankOf = ({ action }: RankParams): number => (action.group === 'act' ? 0 : 1);

export const relatedHitActions = ({ actions }: Params): ReadonlyArray<ResolvedAction> =>
  actions
    .filter((action) => action.group !== 'danger' && action.label !== 'Open')
    .map((action, index) => ({ action, index }))
    .sort(
      (left, right) =>
        rankOf({ action: left.action }) - rankOf({ action: right.action }) ||
        left.index - right.index,
    )
    .slice(0, RELATED_LIMIT)
    .map(({ action }) => action);
