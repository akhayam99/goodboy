import type {
  CredentialId,
  IsoDateTime,
  ProviderConnectionState,
  ProviderId,
  ProviderLimits,
} from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';
import {
  INITIAL_EVIDENCE,
  INITIAL_HEALTH,
  INITIAL_HEALTH_MAP,
  type ProviderHealth,
} from '../../../../../store/slices/providers/providerHealth';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const ACCOUNT = 'mara.quint@harborline.dev';

type ProviderParams = {
  readonly id: ProviderId;
  readonly label: string;
  readonly binary: string;
  readonly connection: ProviderConnectionState;
  readonly version: string | null;
  readonly identity?: string | null;
};

const providerInfo = ({
  id,
  label,
  binary,
  connection,
  version,
  identity = null,
}: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary,
  capabilities: { models: [] },
  connection,
  version,
  identity,
  label,
  error: null,
  docsUrl: '',
});

type IsoParams = {
  readonly ms: number;
};

const isoIn = ({ ms }: IsoParams): IsoDateTime =>
  new Date(Date.now() + ms).toISOString() as IsoDateTime;

const claudeLimits = (): ProviderLimits => ({
  providerId: 'anthropic',
  plan: 'max',
  status: 'warning',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'warning',
      usedFraction: 0.85,
      resetsAt: isoIn({ ms: 3 * HOUR_MS }),
    },
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: 0.48,
      resetsAt: isoIn({ ms: 3 * 24 * HOUR_MS }),
    },
    {
      kind: 'weeklyModel',
      model: 'Fable',
      status: 'ok',
      usedFraction: 0.12,
      resetsAt: isoIn({ ms: 3 * 24 * HOUR_MS }),
    },
  ],
  observedAt: isoIn({ ms: -2 * MINUTE_MS }),
});

const codexLimits = (): ProviderLimits => ({
  providerId: 'codex',
  plan: 'pro',
  status: 'reached',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'reached',
      usedFraction: 1,
      resetsAt: isoIn({ ms: 52 * MINUTE_MS }),
    },
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: 0.62,
      resetsAt: isoIn({ ms: 5 * 24 * HOUR_MS }),
    },
  ],
  observedAt: isoIn({ ms: -2 * MINUTE_MS }),
});

type HealthParams = {
  readonly agoMs: number;
};

const confirmed = ({ agoMs }: HealthParams): ProviderHealth => ({
  ...INITIAL_HEALTH,
  standing: 'connected',
  evidence: {
    ...INITIAL_EVIDENCE,
    serverAccepted: true,
    localTokens: true,
    lastGoodAt: Date.now() - agoMs,
  },
});

const PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [
  providerInfo({
    id: 'anthropic',
    label: 'Claude',
    binary: 'claude',
    connection: 'connected',
    version: '2.1.296',
    identity: ACCOUNT,
  }),
  providerInfo({
    id: 'cursor',
    label: 'Cursor',
    binary: 'cursor-agent',
    connection: 'connected',
    version: '2026.11.04',
    identity: ACCOUNT,
  }),
  providerInfo({
    id: 'codex',
    label: 'Codex',
    binary: 'codex',
    connection: 'connected',
    version: '0.98.0',
    identity: ACCOUNT,
  }),
  providerInfo({
    id: 'opencode',
    label: 'OpenCode',
    binary: 'opencode',
    connection: 'connected',
    version: '1.4.2',
  }),
  providerInfo({
    id: 'openrouter',
    label: 'OpenRouter',
    binary: 'opencode',
    connection: 'connected',
    version: '1.4.2',
  }),
  providerInfo({
    id: 'gemini',
    label: 'Gemini',
    binary: 'agy',
    connection: 'missing',
    version: null,
  }),
  providerInfo({
    id: 'copilot',
    label: 'Copilot',
    binary: 'copilot',
    connection: 'installed_disconnected',
    version: '0.0.412',
  }),
  providerInfo({
    id: 'moonshot',
    label: 'Moonshot',
    binary: 'opencode',
    connection: 'connected',
    version: '1.4.2',
  }),
];

export const seedConnectionsProviders = (): void => {
  useAppStore.setState({
    providers: PROVIDERS,
    refreshProviders: async () => undefined,
    providerLimits: { anthropic: claudeLimits(), codex: codexLimits() },
    authResults: {
      anthropic: { state: 'connected', identity: ACCOUNT, plan: 'max' },
      codex: { state: 'connected', identity: ACCOUNT, plan: 'pro' },
      cursor: { state: 'connected', identity: ACCOUNT, plan: 'pro' },
    },
    providerHealth: {
      ...INITIAL_HEALTH_MAP,
      anthropic: confirmed({ agoMs: 20_000 }),
      codex: confirmed({ agoMs: MINUTE_MS }),
      cursor: confirmed({ agoMs: 4 * MINUTE_MS }),
    },
    providerCredentials: [
      {
        id: 'credential-openrouter-harborline' as CredentialId,
        providerId: 'openrouter',
        label: 'Harborline key',
        hint: '····a91f',
        createdAt: isoIn({ ms: -12 * 24 * HOUR_MS }),
      },
    ],
  });
};
