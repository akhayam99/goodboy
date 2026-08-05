import type { EffortLevel, MoonshotModel } from '@goodboy/types';

const EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<EffortLevel>;

export const MOONSHOT_CATALOG = [
  {
    key: 'kimi-k3',
    label: 'Kimi K3',
    tier: 'turn',
    contextWindow: 1_048_576,
    presentation: {
      family: 'other',
      group: null,
      version: 'Kimi K3',
      order: 10,
      costTier: 'mid',
    },
    provider: 'moonshot',
    cliId: 'moonshotai/kimi-k3',
    efforts: EFFORTS,
    defaultEffort: 'medium',
  },
] satisfies ReadonlyArray<MoonshotModel>;
