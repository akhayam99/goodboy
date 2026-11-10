import type { AutoDelegation } from '@goodboy/db';
import { aDelegation, aView } from '../../../../../../features/auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../../../../../../store/slices/auto-view/state';

export type AutoPushVariant = 'ask' | 'results';

type PushParams = {
  readonly key: string;
  readonly branch: string;
  readonly state: string;
  readonly message?: string | null;
  readonly isRetryable?: boolean;
};

const pushOf = ({
  key,
  branch,
  state,
  message = null,
  isRetryable = false,
}: PushParams): AutoDelegation =>
  aDelegation({
    key,
    role: 'implementer',
    state: 'settled',
    outcome: 'completed',
    settledAt: 1_000,
    result: {
      declared: { summary: 'Squashed the retry commits.' },
      verified: {
        changedFiles: [],
        checks: [],
        publish: {
          mode: 'force',
          state,
          branch,
          sha: 'abc1234',
          leaseSha: 'remote111',
          backupRef: `refs/goodboy/backup/${key}/keep-1`,
          message,
          isRetryable,
          isConfirmed: state !== 'awaiting_confirm' && state !== 'declined',
          tries: state === 'awaiting_confirm' ? 0 : 1,
          reviewerReportId: null,
          isContentChanging: false,
        },
      },
      cost: { usd: 0.4, basis: 'reported' },
    },
  });

const DELEGATIONS: Readonly<Record<AutoPushVariant, ReadonlyArray<AutoDelegation>>> = {
  ask: [
    pushOf({ key: 'ledger', branch: 'harborline/fix-ledger', state: 'awaiting_confirm' }),
    pushOf({ key: 'notify', branch: 'harborline/fix-notify', state: 'awaiting_confirm' }),
  ],
  results: [
    pushOf({ key: 'ledger', branch: 'harborline/fix-ledger', state: 'pushed' }),
    pushOf({
      key: 'notify',
      branch: 'harborline/fix-notify',
      state: 'failed',
      message: 'Origin changed. Check again before force pushing.',
      isRetryable: true,
    }),
    pushOf({ key: 'payments', branch: 'harborline/fix-payments', state: 'pushing' }),
    pushOf({ key: 'acme', branch: 'acme/tidy-history', state: 'declined' }),
  ],
};

type ViewParams = {
  readonly variant: AutoPushVariant;
};

export const autoPushViewOf = ({ variant }: ViewParams): AutoTreeView =>
  aView({ phase: 'waiting', delegations: DELEGATIONS[variant] });
