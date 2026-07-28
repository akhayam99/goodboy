import type { AnthropicModel, EffortLevel } from '@goodboy/types';

const OPUS_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] satisfies ReadonlyArray<EffortLevel>;
const SONNET_EFFORTS = ['low', 'medium', 'high'] satisfies ReadonlyArray<EffortLevel>;

export const ANTHROPIC_CATALOG = [
  {
    key: 'opus-5',
    label: 'Opus 5',
    tier: 'turn',
    provider: 'anthropic',
    cliId: 'claude-opus-5',
    efforts: OPUS_EFFORTS,
    defaultEffort: 'high',
  },
  {
    key: 'fable-5',
    label: 'Fable 5',
    tier: 'turn',
    provider: 'anthropic',
    cliId: 'claude-fable-5',
    efforts: OPUS_EFFORTS,
    defaultEffort: 'high',
  },
  {
    key: 'opus-4.8',
    label: 'Opus 4.8',
    tier: 'turn',
    provider: 'anthropic',
    cliId: 'claude-opus-4-8',
    efforts: OPUS_EFFORTS,
    defaultEffort: 'high',
  },
  {
    key: 'opus-4.7',
    label: 'Opus 4.7',
    tier: 'turn',
    provider: 'anthropic',
    cliId: 'claude-opus-4-7',
    efforts: OPUS_EFFORTS,
    defaultEffort: 'high',
  },
  {
    key: 'opus-4.6',
    label: 'Opus 4.6',
    tier: 'turn',
    provider: 'anthropic',
    cliId: 'claude-opus-4-6',
    efforts: OPUS_EFFORTS,
    defaultEffort: 'high',
  },
  {
    key: 'sonnet-4.6',
    label: 'Sonnet 4.6',
    tier: 'turn',
    provider: 'anthropic',
    cliId: 'claude-sonnet-4-6',
    efforts: SONNET_EFFORTS,
    defaultEffort: 'medium',
  },
  {
    key: 'sonnet-4.5',
    label: 'Sonnet 4.5',
    tier: 'turn',
    provider: 'anthropic',
    cliId: 'claude-sonnet-4-5',
    efforts: SONNET_EFFORTS,
    defaultEffort: 'medium',
  },
  {
    key: 'haiku-4.5',
    label: 'Haiku 4.5',
    tier: 'cheap',
    provider: 'anthropic',
    cliId: 'claude-haiku-4-5',
    efforts: [],
    defaultEffort: 'medium',
  },
] satisfies ReadonlyArray<AnthropicModel>;
