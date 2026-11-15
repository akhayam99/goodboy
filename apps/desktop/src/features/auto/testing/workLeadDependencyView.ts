import type { AutoGrant, AutoGrantId } from '@goodboy/db';
import { brandId, type AutoDelegationId, type AutoTreeId } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { aDelegation, aView } from './autoViewFixtures';

const GRANT_ID = 'grant-dependency-attempt-tester';

const tester = aDelegation({
  key: 'tester',
  role: 'tester',
  state: 'settled',
  outcome: 'completed',
  settledAt: 1_000,
  result: {
    declared: {
      summary: 'Stopped before installing nock 14.0.1, to mock the retried delivery.',
    },
    verified: { changedFiles: [], checks: [] },
    cost: { usd: 0.22, basis: 'reported' },
  },
});

type GrantParams = {
  readonly treeId: AutoTreeId;
};

const dependencyGrantOf = ({ treeId }: GrantParams): AutoGrant => ({
  id: brandId<AutoGrantId>({ value: GRANT_ID }),
  treeId,
  delegationId: brandId<AutoDelegationId>({ value: tester.id }),
  attemptId: null,
  textVersion: null,
  kind: 'dependency',
  subject: 'nock@14.0.1',
  state: 'asked',
  isCurrent: true,
  answeredAt: null,
  createdAt: 1_000,
});

export const workLeadDependencyView = (): AutoTreeView => {
  const view = aView({ phase: 'waiting', delegations: [tester] });
  return { ...view, grantAsks: [dependencyGrantOf({ treeId: view.tree.id })] };
};
