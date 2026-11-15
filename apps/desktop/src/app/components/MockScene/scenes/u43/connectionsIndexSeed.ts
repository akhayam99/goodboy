import { brandId } from '@goodboy/types';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  ProviderConnectionState,
  ProviderId,
  ProviderLimitStatus,
  ProviderLimits,
  WorkspaceId,
} from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';
import type { IntegrationKeyCheck } from '../../../../../store/slices/integrations/state';

export type ConnectionsIndexVariant = 'healthy' | 'warnings' | 'empty' | 'no-workspace';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const IDENTITY = 'mara.quint@harborline.dev';
const WARNING_FRACTION = 0.8;

type ProviderParams = {
  readonly id: ProviderId;
  readonly label: string;
  readonly connection: ProviderConnectionState;
  readonly version?: string;
};

const providerInfo = ({
  id,
  label,
  connection,
  version = '99.0.0',
}: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [] },
  connection,
  version: connection === 'missing' ? null : version,
  identity: connection === 'connected' ? IDENTITY : null,
  label,
  error: null,
  docsUrl: '',
});

type IsoParams = {
  readonly ms: number;
};

const isoIn = ({ ms }: IsoParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(Date.now() + ms).toISOString() });

type LimitsParams = {
  readonly providerId: ProviderId;
  readonly plan: string;
  readonly fiveHour: number;
  readonly weekly: number;
};

type StatusParams = {
  readonly usedFraction: number;
};

const statusOf = ({ usedFraction }: StatusParams): ProviderLimitStatus => {
  if (usedFraction >= 1) {
    return 'reached';
  }
  return usedFraction >= WARNING_FRACTION ? 'warning' : 'ok';
};

const limitsOf = ({ providerId, plan, fiveHour, weekly }: LimitsParams): ProviderLimits => ({
  providerId,
  plan,
  status: fiveHour >= 1 ? 'reached' : 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: statusOf({ usedFraction: fiveHour }),
      usedFraction: fiveHour,
      resetsAt: isoIn({ ms: 2 * HOUR_MS + 20 * MINUTE_MS }),
    },
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: weekly,
      resetsAt: isoIn({ ms: 3 * 24 * HOUR_MS }),
    },
  ],
  observedAt: isoIn({ ms: -2 * MINUTE_MS }),
});

type BindingParams = {
  readonly workspaceId: WorkspaceId;
};

const AT = brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' });

const GITLAB_KEY = brandId<IntegrationCredentialId>({ value: 'mock-connections-gitlab-key' });

const LINEAR_KEY = brandId<IntegrationCredentialId>({ value: 'mock-connections-linear-key' });

const SENTRY_KEY = brandId<IntegrationCredentialId>({ value: 'mock-connections-sentry-key' });

const bindingsOf = ({ workspaceId }: BindingParams): ReadonlyArray<IntegrationBinding> => [
  {
    id: brandId<IntegrationBindingId>({ value: 'mock-connections-gitlab' }),
    workspaceId,
    projectId: null,
    provider: 'gitlab',
    config: { userName: 'platform-lead', userId: '7', host: 'gitlab.northwind.dev' },
    credentialId: GITLAB_KEY,
    createdAt: AT,
    updatedAt: AT,
  },
  {
    id: brandId<IntegrationBindingId>({ value: 'mock-connections-linear' }),
    workspaceId,
    projectId: null,
    provider: 'linear',
    config: { workspaceUrlKey: 'harborline', viewerUserId: 'u-1', viewerName: 'Mara Quint' },
    credentialId: LINEAR_KEY,
    createdAt: AT,
    updatedAt: AT,
  },
  {
    id: brandId<IntegrationBindingId>({ value: 'mock-connections-sentry' }),
    workspaceId,
    projectId: null,
    provider: 'sentry',
    config: { org: 'harborline', project: 'payments-api' },
    credentialId: SENTRY_KEY,
    createdAt: AT,
    updatedAt: AT,
  },
];

type CheckParams = {
  readonly isPresent: boolean;
  readonly minutesAgo: number;
};

const checkOf = ({ isPresent, minutesAgo }: CheckParams): IntegrationKeyCheck => ({
  isPresent,
  checkedAt: Date.now() - minutesAgo * MINUTE_MS,
});

type ProvidersParams = {
  readonly isWarning: boolean;
};

const providersOf = ({ isWarning }: ProvidersParams): ReadonlyArray<ProviderDisplayInfo> => [
  providerInfo({ id: 'anthropic', label: 'Claude', connection: 'connected' }),
  providerInfo({ id: 'cursor', label: 'Cursor', connection: 'connected' }),
  providerInfo({ id: 'codex', label: 'Codex', connection: 'connected' }),
  providerInfo({ id: 'gemini', label: 'Gemini', connection: 'missing' }),
  providerInfo({ id: 'copilot', label: 'Copilot', connection: 'installed_disconnected' }),
  providerInfo({
    id: 'opencode',
    label: 'OpenCode',
    connection: 'connected',
    ...(isWarning && { version: '0.0.1' }),
  }),
  providerInfo({ id: 'openrouter', label: 'OpenRouter', connection: 'connected' }),
  providerInfo({ id: 'moonshot', label: 'Moonshot', connection: 'missing' }),
];

const EMPTY_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [
  providerInfo({ id: 'anthropic', label: 'Claude', connection: 'missing' }),
  providerInfo({ id: 'cursor', label: 'Cursor', connection: 'missing' }),
  providerInfo({ id: 'codex', label: 'Codex', connection: 'installed_disconnected' }),
  providerInfo({ id: 'gemini', label: 'Gemini', connection: 'missing' }),
  providerInfo({ id: 'openrouter', label: 'OpenRouter', connection: 'missing' }),
];

type SeedParams = {
  readonly workspaceId: WorkspaceId;
  readonly variant: ConnectionsIndexVariant;
};

export const seedConnectionsIndex = ({ workspaceId, variant }: SeedParams): void => {
  const isWarning = variant === 'warnings';
  const isEmpty = variant === 'empty';
  useAppStore.setState({
    providers: isEmpty ? EMPTY_PROVIDERS : providersOf({ isWarning }),
    refreshProviders: async () => undefined,
    checkTools: async () => undefined,
    providerLimits: isEmpty
      ? {}
      : {
          anthropic: limitsOf({
            providerId: 'anthropic',
            plan: 'max',
            fiveHour: isWarning ? 0.85 : 0.32,
            weekly: 0.48,
          }),
          codex: limitsOf({
            providerId: 'codex',
            plan: 'pro',
            fiveHour: isWarning ? 1 : 0.12,
            weekly: 0.62,
          }),
        },
    githubWorkspaceStatus: isEmpty
      ? {}
      : { [workspaceId]: { mode: 'gh-cli', available: true, user: 'harborline-bot' } },
    workspaceIntegrations: { [workspaceId]: isEmpty ? [] : bindingsOf({ workspaceId }) },
    integrationKeyChecks: isEmpty
      ? {}
      : {
          [GITLAB_KEY]: checkOf({ isPresent: !isWarning, minutesAgo: 5 }),
          [LINEAR_KEY]: checkOf({ isPresent: true, minutesAgo: 1 }),
          [SENTRY_KEY]: checkOf({ isPresent: true, minutesAgo: 8 }),
        },
    ...(variant === 'no-workspace' && { currentWorkspaceId: null }),
  });
};
