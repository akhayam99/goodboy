import type { ProviderId } from '@goodboy/types';

export type ProviderStrikes = Readonly<Partial<Record<ProviderId, number>>>;

type Params = {
  readonly strikes: ProviderStrikes;
  readonly provider: ProviderId;
  readonly atMs: number;
};

export const withProviderStrike = ({ strikes, provider, atMs }: Params): ProviderStrikes => ({
  ...strikes,
  [provider]: Math.max(strikes[provider] ?? 0, atMs),
});
