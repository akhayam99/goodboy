import type { ResolveThread } from '@goodboy/types';

type ThreadParams = { readonly thread: ResolveThread };

export const isRunFailedThread = ({ thread }: ThreadParams): boolean =>
  thread.state === 'failed' && thread.stateReason?.startsWith('publication_failed:') !== true;

export const isFixableThread = ({ thread }: ThreadParams): boolean =>
  thread.stage === 'new' || (thread.stage === 'failed' && isRunFailedThread({ thread }));
