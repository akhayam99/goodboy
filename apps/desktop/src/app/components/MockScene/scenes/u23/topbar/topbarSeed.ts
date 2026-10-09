import type { Notification } from '@goodboy/db';
import type { IsoDateTime, ProviderId, ProviderLimits } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../../features/providers/providers';
import { useAppStore } from '../../../../../../store';

const OBSERVED_AT = new Date().toISOString() as IsoDateTime;

const RESETS_AT = new Date(Date.now() + 3 * 86_400_000).toISOString() as IsoDateTime;

type ProviderSeed = {
  readonly id: ProviderId;
  readonly label: string;
  readonly binary: string;
  readonly usedFraction: number;
};

const SEEDS: ReadonlyArray<ProviderSeed> = [
  { id: 'anthropic', label: 'Claude', binary: 'claude', usedFraction: 0.47 },
  { id: 'codex', label: 'Codex', binary: 'codex', usedFraction: 0.82 },
  { id: 'cursor', label: 'Cursor', binary: 'cursor-agent', usedFraction: 0.31 },
  { id: 'gemini', label: 'Gemini', binary: 'gemini', usedFraction: 1 },
];

const providerRow = ({ id, label, binary }: ProviderSeed): ProviderDisplayInfo => ({
  id,
  binary,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected',
  version: '1.0.0',
  identity: 'harborline',
  label,
  error: null,
  docsUrl: 'https://example.invalid/docs',
});

const limitsOf = ({ id, usedFraction }: ProviderSeed): ProviderLimits => ({
  providerId: id,
  plan: 'Max',
  status: usedFraction >= 1 ? 'reached' : 'ok',
  windows: [
    {
      kind: 'weekly',
      model: null,
      status: usedFraction >= 1 ? 'reached' : 'ok',
      usedFraction,
      resetsAt: RESETS_AT,
    },
  ],
  observedAt: OBSERVED_AT,
});

type LimitsParams = {
  readonly count: number;
};

export const seedTopbarLimits = ({ count }: LimitsParams): void => {
  const seeds = SEEDS.slice(0, count);
  useAppStore.setState({
    providers: seeds.map(providerRow),
    providerLimits: Object.fromEntries(seeds.map((seed) => [seed.id, limitsOf(seed)])),
  });
};

const unread = ({ id, title }: { readonly id: string; readonly title: string }): Notification => ({
  id,
  ts: new Date().toISOString() as IsoDateTime,
  sessionId: null,
  workspaceId: null,
  read: false,
  action: null,
  coalesceKey: null,
  kind: 'pr-created',
  title,
  body: 'payments-api #318',
  severity: 'success',
});

export const seedTopbarBell = (): void => {
  useAppStore.setState({
    notifications: [
      unread({ id: 'mock-topbar-notification-1', title: 'Pull request opened' }),
      unread({ id: 'mock-topbar-notification-2', title: 'Checks passed' }),
      unread({ id: 'mock-topbar-notification-3', title: 'Review requested' }),
    ],
  });
};
