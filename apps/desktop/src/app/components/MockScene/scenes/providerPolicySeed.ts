import type {
  IsoDateTime,
  ProviderConnectionState,
  ProviderId,
  ProviderLimits,
  ProviderPolicy,
  WorkspaceId,
} from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

type ProviderParams = {
  readonly id: ProviderId;
  readonly label: string;
  readonly binary: string;
  readonly connection: ProviderConnectionState;
};

const providerInfo = ({ id, label, binary, connection }: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary,
  capabilities: CAPABILITIES,
  connection,
  version: connection === 'connected' ? '2.1.290' : null,
  identity: connection === 'connected' ? 'mara.quint@harborline.dev' : null,
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
      resetsAt: isoIn({ ms: 2 * HOUR_MS + 10 * MINUTE_MS }),
    },
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: 0.71,
      resetsAt: isoIn({ ms: 2 * 24 * HOUR_MS }),
    },
  ],
  observedAt: isoIn({ ms: -3 * MINUTE_MS }),
});

const POLICY: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'codex', state: 'on' },
  { id: 'cursor', state: 'backup', payAsYouGo: true },
  { id: 'gemini', state: 'off' },
];

type SeedParams = {
  readonly workspaceId: WorkspaceId;
  readonly hasNewProvider?: boolean;
};

export const seedPolicyScene = ({ workspaceId, hasNewProvider = false }: SeedParams): void => {
  useAppStore.setState((state) => {
    const current =
      state.workspaceOverrides[workspaceId] ??
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.overrides;
    return {
      providers: [
        providerInfo({
          id: 'anthropic',
          label: 'Claude',
          binary: 'claude',
          connection: 'connected',
        }),
        providerInfo({ id: 'codex', label: 'Codex', binary: 'codex', connection: 'connected' }),
        providerInfo({
          id: 'cursor',
          label: 'Cursor',
          binary: 'cursor-agent',
          connection: 'connected',
        }),
        providerInfo({ id: 'gemini', label: 'Gemini', binary: 'agy', connection: 'connected' }),
        providerInfo({
          id: 'opencode',
          label: 'OpenCode',
          binary: 'opencode',
          connection: hasNewProvider ? 'connected' : 'installed_disconnected',
        }),
      ],
      refreshProviders: async () => undefined,
      providerLimits: { anthropic: claudeLimits(), codex: codexLimits() },
      workspaceOverrides:
        current === undefined
          ? state.workspaceOverrides
          : {
              ...state.workspaceOverrides,
              [workspaceId]: { ...current, defaultProviderId: 'anthropic', providerPool: POLICY },
            },
    };
  });
};
