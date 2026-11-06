import type { AutoTreeView } from '../../../store/slices/auto-view/state';

type Params = {
  readonly view: AutoTreeView;
};

const NOT_YET_RUNNING: ReadonlySet<AutoTreeView['delegations'][number]['state']> = new Set([
  'awaiting_confirm',
  'settled',
]);

export const openDelegationCountOf = ({ view }: Params): number =>
  view.delegations.filter((delegation) => !NOT_YET_RUNNING.has(delegation.state)).length;
