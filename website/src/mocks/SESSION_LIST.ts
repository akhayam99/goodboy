import type { SessionListItem } from './SessionListItem';

export const SESSION_LIST: ReadonlyArray<SessionListItem> = [
  {
    id: 'duplicate-credit',
    title: 'Duplicate credit fix',
    state: 'question',
    stateLabel: 'Needs you',
    isSelected: true,
  },
  {
    id: 'payout-export',
    title: 'Speed up the payout export',
    state: 'running',
    stateLabel: 'Running',
  },
  {
    id: 'retried-webhooks',
    title: 'Stop retried webhooks posting a second credit',
    state: 'done',
    stateLabel: 'Done',
  },
  {
    id: 'signing-secret',
    title: 'Rotate the processor signing secret',
    state: 'queued',
    stateLabel: 'Idle',
  },
];
