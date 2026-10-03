import type { IsoDateTime, ProviderId, ProviderLimits } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

const connected = (id: ProviderId, binary: string, label: string): ProviderDisplayInfo => ({
  id,
  binary,
  capabilities: CAPABILITIES,
  connection: 'connected',
  version: '9.0.0',
  identity: 'mara@harborline.dev',
  label,
  error: null,
  docsUrl: 'https://docs.harborline.dev',
});

export const RULES_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [
  connected('anthropic', 'claude', 'Claude'),
  connected('codex', 'codex', 'Codex'),
  connected('cursor', 'cursor-agent', 'Cursor'),
  connected('gemini', 'agy', 'Gemini'),
];

const isoIn = (ms: number): IsoDateTime => new Date(Date.now() + ms).toISOString() as IsoDateTime;

type LimitsParams = {
  readonly providerId: ProviderId;
  readonly fiveHour: number;
  readonly weekly: number;
};

const limits = ({ providerId, fiveHour, weekly }: LimitsParams): ProviderLimits => ({
  providerId,
  plan: 'max',
  status: fiveHour >= 0.8 ? 'warning' : 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: fiveHour >= 0.8 ? 'warning' : 'ok',
      usedFraction: fiveHour,
      resetsAt: isoIn(2 * HOUR_MS),
    },
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: weekly,
      resetsAt: isoIn(3 * 24 * HOUR_MS),
    },
  ],
  observedAt: isoIn(-2 * MINUTE_MS),
});

export const rulesProviderLimits = (): Readonly<Partial<Record<ProviderId, ProviderLimits>>> => ({
  anthropic: limits({ providerId: 'anthropic', fiveHour: 0.85, weekly: 0.41 }),
  codex: limits({ providerId: 'codex', fiveHour: 0.22, weekly: 0.18 }),
});
