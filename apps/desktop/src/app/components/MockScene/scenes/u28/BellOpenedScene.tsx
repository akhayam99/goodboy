import type { Notification } from '@goodboy/db';
import { BellFrame } from './BellFrame';
import { WORKSPACE_ID } from '../BoardScene';
import { BELL_SESSION_ID, RETRY, rowOf } from './bellRows';

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
    isActed: true,
  }),
  rowOf({
    index: 3,
    title: '1 session folder left on disk',
    body: null,
    kind: 'orphan-worktrees',
    severity: 'info',
    action: { kind: 'open-orphan-worktrees', workspaceId: WORKSPACE_ID },
  }),
];

const CLICKS: ReadonlyArray<string> = ['All'];

export const BellOpenedScene = () => <BellFrame notifications={NOTIFICATIONS} clicks={CLICKS} />;
