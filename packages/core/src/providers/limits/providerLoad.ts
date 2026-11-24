import type { ProviderId } from '@goodboy/types';
import { isProviderId } from '@goodboy/types/helpers';

type ProviderAgent = Readonly<{
  provider: string;
  agentId: string;
}>;

type FinishedAgent = ProviderAgent &
  Readonly<{
    lastEndedAtMs: number;
  }>;

type Params = {
  readonly finished: ReadonlyArray<FinishedAgent>;
  readonly running: ReadonlyArray<ProviderAgent>;
  readonly sinceMs: number;
};

export const providerLoad = ({
  finished,
  running,
  sinceMs,
}: Params): Readonly<Partial<Record<ProviderId, number>>> => {
  const recent = finished.filter((agent) => agent.lastEndedAtMs >= sinceMs);
  const agents = new Map<ProviderId, Set<string>>();
  for (const { provider, agentId } of [...recent, ...running]) {
    if (!isProviderId(provider)) {
      continue;
    }
    const seen = agents.get(provider) ?? new Set<string>();
    seen.add(agentId);
    agents.set(provider, seen);
  }
  return Object.fromEntries([...agents].map(([provider, seen]) => [provider, seen.size]));
};
