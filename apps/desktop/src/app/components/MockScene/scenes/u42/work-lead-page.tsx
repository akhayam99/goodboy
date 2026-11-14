import type { ComponentType } from 'react';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { workLeadDependencyView } from '../../../../../features/auto/testing/workLeadDependencyView';
import { workLeadPushView } from '../../../../../features/auto/testing/workLeadPushView';
import { AutoChatScene } from '../u24/AutoChatScene';

type ViewParams = {
  readonly view: AutoTreeView;
};

type HeldParams = ViewParams & {
  readonly held: AutoTreeView;
};

const withHeldAsks = ({ view, held }: HeldParams): AutoTreeView => {
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

const pushViewOf = ({ view }: ViewParams): AutoTreeView =>
  withHeldAsks({ view, held: workLeadPushView() });

const dependencyViewOf = ({ view }: ViewParams): AutoTreeView =>
  withHeldAsks({ view, held: workLeadDependencyView() });

export const U42_WORK_LEAD_PAGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'work-lead-plan': () => <AutoChatScene state="plan" hasLeadPage />,
  'work-lead-working': () => <AutoChatScene state="leadWorking" hasLeadPage isWorkOn />,
  'work-lead-push': () => (
    <AutoChatScene
      state="working"
      hasLeadPage
      isWorkOn
      viewOf={pushViewOf}
      leadRows={{ push: 'ask' }}
    />
  ),
  'work-lead-dependency': () => (
    <AutoChatScene
      state="working"
      hasLeadPage
      isWorkOn
      viewOf={dependencyViewOf}
      leadRows={{ dependencies: 'ask' }}
    />
  ),
};
