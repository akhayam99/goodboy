import type { EffortLevel, OpencodeModel } from '@goodboy/types';

const EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<EffortLevel>;

export const OPENCODE_CATALOG = [
  {
    key: 'big-pickle',
    label: 'Big Pickle',
    tier: 'turn',
    provider: 'opencode',
    cliId: 'opencode/big-pickle',
    efforts: EFFORTS,
    defaultEffort: 'medium',
  },
  {
    key: 'minimax-m2.5',
    label: 'MiniMax M2.5',
    tier: 'cheap',
    provider: 'opencode',
    cliId: 'opencode/minimax-m2.5-free',
    efforts: EFFORTS,
    defaultEffort: 'medium',
  },
  {
    key: 'nemotron-3-super',
    label: 'Nemotron 3 Super',
    tier: 'cheap',
    provider: 'opencode',
    cliId: 'opencode/nemotron-3-super-free',
    efforts: EFFORTS,
    defaultEffort: 'medium',
  },
  {
    key: 'ring-2.6-1t',
    label: 'Ring 2.6 1T',
    tier: 'cheap',
    provider: 'opencode',
    cliId: 'opencode/ring-2.6-1t-free',
    efforts: EFFORTS,
    defaultEffort: 'medium',
  },
] satisfies ReadonlyArray<OpencodeModel>;
