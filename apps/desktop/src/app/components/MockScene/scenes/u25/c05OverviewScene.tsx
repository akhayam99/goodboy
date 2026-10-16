import { useEffect } from 'react';
import type {
  IsoDateTime,
  MountBranchObservation,
  MountCleanupProposal,
  MountId,
  ProjectId,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { sceneClock } from '../../sceneClock';
import { MountsScene } from '../MountsScene';

const clock = sceneClock({ anchor: '2026-09-07T13:15:00.000Z' });

const NOW: IsoDateTime = clock.iso({ at: '2026-09-07T09:12:00.000Z' });

const SESSION_ID = brandedId<SessionId>({ value: 'mock-session-mount-rows' });
const LEDGER_ID = brandedId<ProjectId>({ value: 'mock-project-ledger-core' });
const RELAY_ID = brandedId<ProjectId>({ value: 'mock-project-notify-relay' });
const ROUNDING_MOUNT = brandedId<MountId>({ value: 'mock-mount-ledger-rounding' });
const RELAY_MOUNT = brandedId<MountId>({ value: 'mock-mount-relay-backoff' });
const MB = 1024 * 1024;

type ProposalParams = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly root: string;
  readonly branch: string;
  readonly prNumber: number;
  readonly megabytes: number;
};

const proposalOf = ({
  mountId,
  projectId,
  root,
  branch,
  prNumber,
  megabytes,
}: ProposalParams): MountCleanupProposal => ({
  requestId: `mock-cleanup-${mountId}`,
  sessionId: SESSION_ID,
  mountId,
  projectId,
  reason: 'merge_cleanup',
  repoRoot: root,
  worktreePath: `${root}-${branch.split('/').at(-1) ?? 'work'}`,
  branch,
  sizeBytes: megabytes * MB,
  request: { provider: 'github', host: 'github.com', repoSlug: 'harborline/ledger-core', prNumber },
  createdAt: NOW,
});

const ROUNDING_PROPOSAL = proposalOf({
  mountId: ROUNDING_MOUNT,
  projectId: LEDGER_ID,
  root: '~/code/harborline/ledger-core',
  branch: 'fix/ledger-reconciliation-rounding-drift',
  prNumber: 418,
  megabytes: 412,
});

const RELAY_PROPOSAL = proposalOf({
  mountId: RELAY_MOUNT,
  projectId: RELAY_ID,
  root: '~/code/harborline/notify-relay',
  branch: 'fix/notify-relay-webhook-rate-limit-backoff',
  prNumber: 96,
  megabytes: 640,
});

const DRIFT: MountBranchObservation = {
  mountId: RELAY_MOUNT,
  sessionId: SESSION_ID,
  state: 'mismatch',
  recordedBranch: 'fix/notify-relay-webhook-rate-limit-backoff',
  observedBranch: 'fix/notify-relay-retry-budget',
  revision: 4,
  observedAt: NOW,
};

type ProposalsParams = {
  readonly proposals: ReadonlyArray<MountCleanupProposal>;
};

const seedProposals = ({ proposals }: ProposalsParams): void => {
  useAppStore.setState({
    mountCleanupProposals: { [SESSION_ID]: proposals },
    loadMountCleanupProposals: async () => proposals,
  });
};

type C05OverviewState = 'merged-next' | 'merged-group' | 'notices';

const SEEDS: Readonly<Record<C05OverviewState, () => void>> = {
  'merged-next': () => seedProposals({ proposals: [ROUNDING_PROPOSAL] }),
  'merged-group': () => seedProposals({ proposals: [ROUNDING_PROPOSAL, RELAY_PROPOSAL] }),
  notices: () => useAppStore.setState({ mountBranchObservations: { [SESSION_ID]: [DRIFT] } }),
};

const VARIANT = {
  'merged-next': 'mounts',
  'merged-group': 'mounts',
  notices: 'gone-branch-restore',
} as const satisfies Record<C05OverviewState, string>;

type Props = {
  readonly state: C05OverviewState;
};

export const C05OverviewScene = ({ state }: Props) => {
  useEffect(() => {
    SEEDS[state]();
  }, [state]);
  return <MountsScene variant={VARIANT[state]} />;
};
