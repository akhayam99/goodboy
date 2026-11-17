import type { ResolveThread } from '@goodboy/types';
import { NEEDS_RUN_REASON } from './needsRunReason';

type ThreadParams = {
  readonly thread: Pick<ResolveThread, 'stage' | 'state' | 'stateReason'>;
};

export const isRunFailedThread = ({ thread }: ThreadParams): boolean =>
  thread.state === 'failed' && thread.stateReason?.startsWith('publication_failed:') !== true;

export const isFixableThread = ({ thread }: ThreadParams): boolean =>
  thread.stage === 'new' ||
  (thread.stage === 'failed' &&
    isRunFailedThread({ thread }) &&
    NEEDS_RUN_REASON.reasonOf({ stateReason: thread.stateReason }) === null);
