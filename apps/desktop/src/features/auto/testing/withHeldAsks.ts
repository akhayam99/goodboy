import type { AutoTreeView } from '../../../store/slices/auto-view/state';

type Params = {
  readonly view: AutoTreeView;
  readonly held: AutoTreeView;
};

export const withHeldAsks = ({ view, held }: Params): AutoTreeView => {
  const treeId = view.tree.id;
  return {
    ...view,
    tree: { ...view.tree, phase: 'waiting' },
    delegations: [
      ...view.delegations.filter((delegation) => delegation.state === 'settled'),
      ...held.delegations.map((delegation) => ({ ...delegation, treeId })),
    ],
    grantAsks: (held.grantAsks ?? []).map((grant) => ({ ...grant, treeId })),
  };
};
