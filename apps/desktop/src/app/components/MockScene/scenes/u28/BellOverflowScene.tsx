import type { Notification } from '@goodboy/db';
import { brandId, type ProviderId } from '@goodboy/types';
import { BellFrame } from './BellFrame';
import { BELL_SESSION_ID, OPEN, RETRY, rowOf } from './bellRows';

const NOTIFICATIONS: ReadonlyArray<Notification> = [
  rowOf({
    index: 0,
    title: 'Push to payments-api failed',
    body: 'The remote rejected the branch.',
    kind: 'error',
    severity: 'error',
    action: { kind: 'retry-publication', sessionId: BELL_SESSION_ID },
  }),
  rowOf({
    index: 1,
    title: 'Handoff degraded',
    body: 'The summarizer timed out.',
    kind: 'summarizer-degraded',
    severity: 'error',
    action: RETRY,
  }),
  rowOf({
    index: 2,
    title: 'Session reached 80% of its limit',
    body: null,
    kind: 'budget-cap',
    severity: 'warning',
    action: { kind: 'open-budget', sessionId: BELL_SESSION_ID },
  }),
  ...Array.from({ length: 6 }, (_, offset) =>
    rowOf({
      index: offset + 3,
      title: `Run ${offset + 1} of the ledger-core suite finished`,
      body: null,
      kind: 'pr-created',
      severity: 'success',
      action: OPEN,
    }),
  ),
  rowOf({
    index: 9,
    title: 'Update the Codex CLI',
    body: null,
    kind: 'provider-cli-outdated',
    severity: 'warning',
    action: { kind: 'update-provider-cli', providerId: brandId<ProviderId>({ value: 'codex' }) },
  }),
  rowOf({
    index: 10,
    title: 'Summarizer failed for notify-relay',
    body: null,
    kind: 'summarizer-degraded',
    severity: 'error',
    action: RETRY,
  }),
];

export const BellOverflowScene = () => <BellFrame notifications={NOTIFICATIONS} />;
