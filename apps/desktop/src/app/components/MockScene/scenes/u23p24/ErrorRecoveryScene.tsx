import type { Notification } from '@goodboy/db';
import { brandId, type MountId } from '@goodboy/types';
import { BellFrame } from '../u28/BellFrame';
import { BELL_SESSION_ID, rowOf } from '../u28/bellRows';

const MOUNT_ID = brandId<MountId>({ value: 'mock-error-recovery-mount-payments-api' });

const NOTIFICATIONS: ReadonlyArray<Notification> = [
  rowOf({
    index: 0,
    title: "Couldn't push the fix.",
    body: 'The remote rejected the branch.\nYour work is still on the branch.',
    kind: 'error',
    severity: 'error',
    action: { kind: 'retry-push', sessionId: BELL_SESSION_ID, mountId: MOUNT_ID },
  }),
  rowOf({
    index: 1,
    title: "Couldn't merge !482",
    body: 'The token was rejected by gitlab.acme.test.',
    kind: 'error',
    severity: 'error',
    action: { kind: 'open-settings', scope: 'tools', tool: 'gitlab' },
  }),
  rowOf({
    index: 2,
    title: "Couldn't open the editor",
    body: 'No editor named code was found.',
    kind: 'error',
    severity: 'error',
    action: { kind: 'open-settings', scope: 'app', section: 'general' },
  }),
  rowOf({
    index: 3,
    title: "Couldn't save the branch prefix",
    body: 'The database is locked.\nNothing was changed.',
    kind: 'error',
    severity: 'error',
  }),
  rowOf({
    index: 4,
    title: "Couldn't read the folder",
    body: 'Cascadia/ledger-core is not reachable.',
    kind: 'error',
    severity: 'warning',
    action: { kind: 'reveal-path', path: '~/code/cascadia/ledger-core' },
  }),
];

export const ErrorRecoveryScene = () => <BellFrame notifications={NOTIFICATIONS} />;
