import type { IsoDateTime, ProviderLimits } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';
import { BRAND_LIMITS } from './canon';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

export const BRAND_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [
  {
    id: 'anthropic',
    binary: 'claude',
    capabilities: CAPABILITIES,
    connection: 'connected',
    version: '2.1.284',
    identity: 'dana@harborline.dev',
    label: 'Claude',
    error: null,
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
  },
  {
    id: 'codex',
    binary: 'codex',
    capabilities: CAPABILITIES,
    connection: 'connected',
    version: '0.58.0',
    identity: 'harborline-platform',
    label: 'Codex',
    error: null,
    docsUrl: 'https://github.com/openai/codex#installation',
  },
  {
    id: 'cursor',
    binary: 'cursor-agent',
    capabilities: CAPABILITIES,
    connection: 'connected',
    version: '2026.9.2',
    identity: 'dana@harborline.dev',
    label: 'Cursor',
    error: null,
    docsUrl: 'https://docs.cursor.com/en/cli/installation',
  },
  {
    id: 'gemini',
    binary: 'agy',
    capabilities: CAPABILITIES,
    connection: 'missing',
    version: null,
    identity: null,
    label: 'Gemini',
    error: null,
    docsUrl: 'https://antigravity.google/cli',
  },
];

const isoIn = (ms: number): IsoDateTime => new Date(Date.now() + ms).toISOString() as IsoDateTime;

type CodexParams = {
  readonly weekly: number;
};

const claudeLimits = (): ProviderLimits => ({
  providerId: 'anthropic',
  plan: 'max',
  status: 'reached',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'reached',
      usedFraction: BRAND_LIMITS.claude.fiveHour,
      resetsAt: BRAND_LIMITS.claude.backAt as IsoDateTime,
    },
    {
      kind: 'weekly',
      model: null,
      status: 'warning',
      usedFraction: BRAND_LIMITS.claude.weekly,
      resetsAt: isoIn(3 * 24 * HOUR_MS + 4 * HOUR_MS),
    },
  ],
  observedAt: isoIn(-2 * MINUTE_MS),
});

const codexLimits = ({ weekly }: CodexParams): ProviderLimits => ({
  providerId: 'codex',
  plan: 'pro',
  status: 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: BRAND_LIMITS.codex.fiveHour,
      resetsAt: isoIn(2 * HOUR_MS + 13 * MINUTE_MS),
    },
    {
      kind: 'weekly',
      model: null,
      status: 'ok',
      usedFraction: weekly,
      resetsAt: isoIn(2 * 24 * HOUR_MS + 7 * HOUR_MS),
    },
  ],
  observedAt: isoIn(-4 * MINUTE_MS),
});

const probeAt = (): { isChecking: false; checkedAt: IsoDateTime; failures: 0 } => ({
  isChecking: false,
  checkedAt: isoIn(-2 * MINUTE_MS),
  failures: 0,
});

type SeedParams = {
  readonly codexWeekly?: number;
};

export const seedBrandLimits = ({ codexWeekly = BRAND_LIMITS.codex.weekly }: SeedParams = {}) => {
  useAppStore.setState({
    providers: BRAND_PROVIDERS,
    refreshProviders: async () => undefined,
    providerLimits: {
      anthropic: claudeLimits(),
      codex: codexLimits({ weekly: codexWeekly }),
    },
    providerLimitsProbe: { anthropic: probeAt(), codex: probeAt() },
    codexResetCredits: {
      availableCount: 1,
      creditId: 'mock-brand-reset-credit',
      expiresAt: BRAND_LIMITS.resetExpiresAt as IsoDateTime,
      observedAt: isoIn(-4 * MINUTE_MS),
    },
    codexPendingReset: null,
    loadProviderLimits: async () => undefined,
    recordProviderLimits: async () => undefined,
    refreshCodexLimits: async () => undefined,
    refreshClaudeUsage: async () => undefined,
    probeProviderLimits: async () => undefined,
    consumeCodexResetCredit: async () => 'failed' as const,
  });
};
