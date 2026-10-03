import type { ProviderId, ProviderPolicy, ProviderPolicyEntry } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '../capabilities';
import { isCuratedProvider } from './defaults';
import { providersByHeadroom, type HeadroomMap } from '../limits/providerHeadroom';

export type ProviderCandidatesContext = {
  readonly defaultProvider: ProviderId;
  readonly fallbackOrder?: ReadonlyArray<ProviderId> | null;
  readonly connected?: ReadonlyArray<ProviderId> | null;
  readonly atLimit?: ReadonlyArray<ProviderId> | null;
  readonly policy?: ProviderPolicy | null;
  readonly headroom?: HeadroomMap | null;
};

export type ProviderStanding = 'usable' | 'not-connected' | 'off' | 'backup' | 'at-limit';

const ALL_PROVIDERS: ReadonlyArray<ProviderId> = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

type EntryParams = {
  readonly policy: ProviderPolicy;
  readonly provider: ProviderId;
};

const entryOf = ({ policy, provider }: EntryParams): ProviderPolicyEntry | null =>
  policy.find((entry) => entry.id === provider) ?? null;

type GateParams = {
  readonly provider: ProviderId;
  readonly context: ProviderCandidatesContext;
};

const isConnected = ({ provider, context }: GateParams): boolean =>
  context.connected == null || context.connected.includes(provider);

const isAtLimit = ({ provider, context }: GateParams): boolean => {
  if (context.atLimit == null || !context.atLimit.includes(provider)) {
    return false;
  }
  if (context.policy == null) {
    return true;
  }
  return entryOf({ policy: context.policy, provider })?.keepAfterLimit !== true;
};

const canWork = ({ provider, context }: GateParams): boolean =>
  isConnected({ provider, context }) && !isAtLimit({ provider, context });

export const providerStanding = ({ provider, context }: GateParams): ProviderStanding => {
  if (!isConnected({ provider, context })) {
    return 'not-connected';
  }
  const state =
    context.policy == null ? 'on' : (entryOf({ policy: context.policy, provider })?.state ?? 'off');
  if (state === 'off') {
    return 'off';
  }
  if (isAtLimit({ provider, context })) {
    return 'at-limit';
  }
  return state === 'backup' ? 'backup' : 'usable';
};

type PolicyParams = {
  readonly policy: ProviderPolicy | null | undefined;
};

export const firstOnProvider = ({ policy }: PolicyParams): ProviderId | null =>
  policy?.find((entry) => entry.state === 'on')?.id ?? null;

const legacyCandidates = (context: ProviderCandidatesContext): ReadonlyArray<ProviderId> => {
  const order = context.fallbackOrder ?? ALL_PROVIDERS;
  const unique = [...new Set([context.defaultProvider, ...order])];
  const usable = unique.filter((provider) => canWork({ provider, context }));
  const curatedFirst = usable.filter(
    (provider) => provider === context.defaultProvider || isCuratedProvider(provider),
  );
  const rest = usable.filter((provider) => !curatedFirst.includes(provider));
  return [...curatedFirst, ...rest];
};

type StateParams = {
  readonly state: ProviderPolicyEntry['state'];
};

export const providerCandidates = (
  context: ProviderCandidatesContext,
): ReadonlyArray<ProviderId> => {
  const policy = context.policy;
  const headroom = context.headroom;
  const spread = (providers: ReadonlyArray<ProviderId>): ReadonlyArray<ProviderId> =>
    headroom == null ? providers : providersByHeadroom({ providers, headroom });
  if (policy == null) {
    return spread(legacyCandidates(context));
  }
  const usableIn = ({ state }: StateParams): ReadonlyArray<ProviderId> =>
    policy
      .filter((entry) => entry.state === state)
      .map((entry) => entry.id)
      .filter((provider) => canWork({ provider, context }));
  const on = usableIn({ state: 'on' });
  const backup = usableIn({ state: 'backup' });
  if (headroom == null) {
    return [...on, ...backup];
  }
  const kept = new Set(spread([...on, ...backup]));
  return [...spread(on), ...spread(backup)].filter((provider) => kept.has(provider));
};

export const workingProviders = (
  context: ProviderCandidatesContext,
): ReadonlyArray<ProviderId> | null => {
  if (context.policy == null) {
    return null;
  }
  const candidates = providerCandidates(context);
  const on = candidates.filter((provider) => providerStanding({ provider, context }) === 'usable');
  return on.length > 0 ? on : candidates;
};

export const policyDefaultProvider = (context: ProviderCandidatesContext): ProviderId =>
  firstOnProvider({ policy: context.policy }) ?? context.defaultProvider;

type SeedParams = {
  readonly defaultProvider: ProviderId;
  readonly connected: ReadonlyArray<ProviderId>;
};

export const seedProviderPolicy = ({ defaultProvider, connected }: SeedParams): ProviderPolicy =>
  legacyCandidates({ defaultProvider, connected }).map((id): ProviderPolicyEntry => ({
    id,
    state: 'on',
  }));
