import { PROVIDER_IDS, type ProviderId } from './provider-registry';

export const PROVIDER_POLICY_STATES = ['on', 'backup', 'off'] as const;

export type ProviderPolicyState = (typeof PROVIDER_POLICY_STATES)[number];

export type ProviderPolicyEntry = Readonly<{
  id: ProviderId;
  state: ProviderPolicyState;
  payAsYouGo?: boolean;
  keepAfterLimit?: boolean;
}>;

export type ProviderPolicy = ReadonlyArray<ProviderPolicyEntry>;

const PROVIDER_ID_SET: ReadonlySet<string> = new Set(PROVIDER_IDS);
const STATE_SET: ReadonlySet<string> = new Set(PROVIDER_POLICY_STATES);

const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && PROVIDER_ID_SET.has(value);

const isPolicyState = (value: unknown): value is ProviderPolicyState =>
  typeof value === 'string' && STATE_SET.has(value);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type NamesParams = {
  readonly names: ReadonlyArray<unknown>;
  readonly defaultProviderId: string | null;
};

const policyFromNames = ({ names, defaultProviderId }: NamesParams): ProviderPolicy | null => {
  if (!names.every(isProviderId)) {
    return null;
  }
  const unique = [...new Set(names)];
  const listed = [
    ...unique.filter((id) => id === defaultProviderId),
    ...unique.filter((id) => id !== defaultProviderId),
  ];
  return [
    ...listed.map((id): ProviderPolicyEntry => ({ id, state: 'on' })),
    ...PROVIDER_IDS.filter((id) => !listed.includes(id)).map((id): ProviderPolicyEntry => ({
      id,
      state: 'off',
    })),
  ];
};

type EntriesParams = {
  readonly entries: ReadonlyArray<unknown>;
};

const policyFromEntries = ({ entries }: EntriesParams): ProviderPolicy | null => {
  const policy: ProviderPolicyEntry[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || !isProviderId(entry.id) || !isPolicyState(entry.state)) {
      return null;
    }
    const id = entry.id;
    if (policy.some((known) => known.id === id)) {
      continue;
    }
    policy.push({
      id,
      state: entry.state,
      ...(entry.payAsYouGo === true && { payAsYouGo: true }),
      ...(entry.keepAfterLimit === true && { keepAfterLimit: true }),
    });
  }
  return policy;
};

type ParseParams = {
  readonly value: unknown;
  readonly defaultProviderId?: string | null;
};

export const parseProviderPolicy = ({
  value,
  defaultProviderId = null,
}: ParseParams): ProviderPolicy | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  if (value.every((entry) => typeof entry === 'string')) {
    return policyFromNames({ names: value, defaultProviderId });
  }
  return policyFromEntries({ entries: value });
};
