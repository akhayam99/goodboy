import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { isAutoWriterRole, type AutoDelegationRole } from './roles';

export const AUTO_WRITER_CHILD_PROVIDERS = [
  'anthropic',
  'codex',
] as const satisfies ReadonlyArray<ProviderId>;

export const AUTO_UNCONFINED_PROVIDERS = [
  'opencode',
  'openrouter',
  'moonshot',
] as const satisfies ReadonlyArray<ProviderId>;

export const AUTO_OWN_PROVIDERS: ReadonlyArray<ProviderId> = PROVIDER_IDS.filter(
  (provider) => !AUTO_UNCONFINED_PROVIDERS.some((candidate) => candidate === provider),
);

type ProviderParams = {
  readonly provider: string;
};

type ChildRoleParams = {
  readonly role: AutoDelegationRole;
};

export const autoChildProviders = ({ role }: ChildRoleParams): ReadonlyArray<ProviderId> =>
  isAutoWriterRole({ role }) ? AUTO_WRITER_CHILD_PROVIDERS : AUTO_OWN_PROVIDERS;

type ChildProviderParams = ProviderParams & ChildRoleParams;

export const isAutoChildProvider = ({ provider, role }: ChildProviderParams): boolean =>
  autoChildProviders({ role }).some((candidate) => candidate === provider);

export const isAutoOwnProvider = ({ provider }: ProviderParams): boolean =>
  AUTO_OWN_PROVIDERS.some((candidate) => candidate === provider);

export const AUTO_RESUMING_PROVIDERS = ['anthropic'] as const satisfies ReadonlyArray<ProviderId>;

export const isAutoProviderResuming = ({ provider }: ProviderParams): boolean =>
  AUTO_RESUMING_PROVIDERS.some((candidate) => candidate === provider);
