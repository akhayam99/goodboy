import type { ProviderId } from '@goodboy/types';

export const AUTO_OWN_PROVIDERS: ReadonlyArray<ProviderId> = ['anthropic'];

export const AUTO_CHILD_PROVIDERS: ReadonlyArray<ProviderId> = ['anthropic', 'codex'];
