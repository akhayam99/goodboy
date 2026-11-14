import type { AutoTreeView } from '../../../../../../store/slices/auto-view/state';

type Params = {
  readonly view: AutoTreeView;
};

const RAW_PLAN_ID = '9cadae67-3b1f-4c2e-9a51-7d0e8f2b4c11';

const ALTERNATIVES = [
  { label: 'Start the implementer on plan v1 as it is', role: 'implementer' },
  { label: 'Ask a reviewer to read plan v1 first', role: 'reviewer' },
];

export const leadNextStepView = ({ view }: Params): AutoTreeView => ({
  ...view,
  delegations: view.delegations.map((delegation) =>
    delegation.state === 'awaiting_confirm'
      ? {
          ...delegation,
          request: {
            task: `Revise plan artifact ${RAW_PLAN_ID} to cover two simultaneous webhooks`,
            reason: 'Rewrites plan v1 to cover two simultaneous webhooks.',
            alternatives: ALTERNATIVES,
          },
        }
      : delegation,
  ),
});
