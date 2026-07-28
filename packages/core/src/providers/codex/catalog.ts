import type { CodexModel, EffortLevel } from '@goodboy/types';

const FULL_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] satisfies ReadonlyArray<EffortLevel>;
const STANDARD_EFFORTS = ['low', 'medium', 'high', 'xhigh'] satisfies ReadonlyArray<EffortLevel>;

export const CODEX_CATALOG = [
  {
    key: 'gpt-5.6',
    label: 'GPT-5.6',
    tier: 'turn',
    provider: 'codex',
    variants: [
      { id: 'sol', label: 'Sol', cliId: 'gpt-5.6-sol' },
      { id: 'terra', label: 'Terra', cliId: 'gpt-5.6-terra' },
      { id: 'luna', label: 'Luna', cliId: 'gpt-5.6-luna' },
    ],
    efforts: FULL_EFFORTS,
    defaultEffort: 'low',
  },
  {
    key: 'gpt-5.5',
    label: 'GPT-5.5',
    tier: 'turn',
    provider: 'codex',
    variants: [{ id: 'default', label: 'Default', cliId: 'gpt-5.5' }],
    efforts: STANDARD_EFFORTS,
    defaultEffort: 'medium',
  },
  {
    key: 'gpt-5.4',
    label: 'GPT-5.4',
    tier: 'turn',
    provider: 'codex',
    variants: [{ id: 'default', label: 'Default', cliId: 'gpt-5.4' }],
    efforts: STANDARD_EFFORTS,
    defaultEffort: 'medium',
  },
  {
    key: 'gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    tier: 'cheap',
    provider: 'codex',
    variants: [{ id: 'default', label: 'Default', cliId: 'gpt-5.4-mini' }],
    efforts: STANDARD_EFFORTS,
    defaultEffort: 'medium',
  },
] satisfies ReadonlyArray<CodexModel>;
