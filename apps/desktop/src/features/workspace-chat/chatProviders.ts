import type { ProviderId } from '@goodboy/types';

const REFUSED: ReadonlySet<ProviderId> = new Set<ProviderId>([
  'opencode',
  'openrouter',
  'moonshot',
]);

export const CHAT_REFUSED_REASON = 'Cannot be limited to reading files, so it cannot answer here';

type Params = {
  readonly provider: ProviderId;
};

export const isChatProviderRefused = ({ provider }: Params): boolean => REFUSED.has(provider);
