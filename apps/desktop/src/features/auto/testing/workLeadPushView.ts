import type { ResultPublish, ResultPullRequest } from '@goodboy/core/auto';
import type { AutoGrant, AutoGrantId } from '@goodboy/db';
import { brandId, type AutoDelegationId, type AutoTreeId } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { aDelegation, aView } from './autoViewFixtures';

const PUSH: ResultPublish = {
  mode: 'push',
  state: 'awaiting_confirm',
  branch: 'harborline/ledger-export',
  sha: 'abc1234def5678',
  leaseSha: null,
  backupRef: null,
  message: null,
  isRetryable: false,
  isConfirmed: false,
  startedAt: null,
  tries: 0,
  reviewerReportId: null,
  isContentChanging: false,
};

const PULL_REQUEST: ResultPullRequest = {
  state: 'awaiting_confirm',
  mountId: 'mount-ledger-core',
  grantId: 'grant-pr-attempt-scribe',
  textVersion: 'attempt-scribe:4f1c2a9b7d3e6f80',
  title: 'Export the ledger as CSV',
  body: 'Adds a CSV export to ledger-core.\n\nThe notify-relay digest links to it.',
  number: null,
  url: null,
  message: null,
  startedAt: null,
};

const implementer = aDelegation({
  key: 'implementer',
  role: 'implementer',
  state: 'settled',
  outcome: 'completed',
  settledAt: 1_000,
  result: {
    declared: { summary: 'Added the CSV export.' },
    verified: { changedFiles: [], checks: [], publish: PUSH },
    cost: { usd: 0.42, basis: 'reported' },
  },
});

const scribe = aDelegation({
  key: 'scribe',
  role: 'scribe',
  state: 'settled',
  outcome: 'completed',
  settledAt: 1_200,
  result: {
    declared: { summary: `The pull request waits for you to open it: ${PULL_REQUEST.title}` },
    verified: { changedFiles: [], checks: [], pullRequest: PULL_REQUEST },
    cost: { usd: 0.08, basis: 'reported' },
  },
});

type GrantParams = {
  readonly treeId: AutoTreeId;
};

const pullRequestGrantOf = ({ treeId }: GrantParams): AutoGrant => ({
  id: brandId<AutoGrantId>({ value: PULL_REQUEST.grantId }),
  treeId,
  delegationId: brandId<AutoDelegationId>({ value: scribe.id }),
  attemptId: null,
  textVersion: PULL_REQUEST.textVersion,
  kind: 'pull_request',
  subject: PULL_REQUEST.mountId,
  state: 'asked',
  isCurrent: true,
  answeredAt: null,
  createdAt: 1_200,
});

export const workLeadPushView = (): AutoTreeView => {
  const view = aView({ phase: 'waiting', delegations: [implementer, scribe] });
  return { ...view, grantAsks: [pullRequestGrantOf({ treeId: view.tree.id })] };
};
