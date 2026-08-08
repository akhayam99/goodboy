import type { ProviderId } from '@goodboy/types';

export const PROVIDER_ORDER = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
] satisfies ReadonlyArray<ProviderId>;

type Expect<T extends true> = T;
type ProviderOrderIsTotal =
  Exclude<ProviderId, (typeof PROVIDER_ORDER)[number]> extends never ? true : false;
type _ProviderOrderTotalCheck = Expect<ProviderOrderIsTotal>;
