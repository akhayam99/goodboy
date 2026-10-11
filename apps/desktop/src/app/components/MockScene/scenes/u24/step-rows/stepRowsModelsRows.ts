import type { ProviderId } from '@goodboy/types';
import {
  modelsSummary,
  type ModelsSummary,
} from '../../../../../../features/session/timeline/ranModels';
import type { WorkTime } from '../../../../../../features/workTreeModel/workTime';

export type StepRowsModelsRow = {
  readonly id: string;
  readonly title: string;
  readonly summary: ModelsSummary | null;
  readonly isPlanned: boolean;
  readonly time: WorkTime;
  readonly cost: string;
  readonly action: string | null;
};

type ModelParams = {
  readonly provider: ProviderId;
  readonly name: string;
  readonly effort?: string | null;
  readonly stepCount?: number;
};

const modelOf = ({ provider, name, effort = null, stepCount = 1 }: ModelParams) => ({
  key: `${provider}:${name}`,
  provider,
  name,
  effort,
  stepCount,
});

type TimeParams = {
  readonly label: string;
};

const timeOf = ({ label }: TimeParams): WorkTime => ({
  label,
  detail: `Active ${label}`,
  progress: null,
  headline: label,
  note: null,
  isMuchLonger: false,
});

export const STEP_ROWS_MODELS_ROWS: ReadonlyArray<StepRowsModelsRow> = [
  {
    id: 'one',
    title: 'Implement the credit writer',
    summary: modelsSummary({
      models: [modelOf({ provider: 'anthropic', name: 'Sonnet 5.5', effort: 'High' })],
    }),
    isPlanned: false,
    time: timeOf({ label: '4m 12s' }),
    cost: '$0.62',
    action: null,
  },
  {
    id: 'planned',
    title: 'Review the ledger posting',
    summary: modelsSummary({
      models: [modelOf({ provider: 'anthropic', name: 'Opus 5.5', effort: 'High' })],
    }),
    isPlanned: true,
    time: timeOf({ label: '~6m' }),
    cost: '~$0.90',
    action: null,
  },
  {
    id: 'cursor',
    title: 'Draft the webhook handler',
    summary: {
      name: 'Composer 2',
      detail: 'Thinking · High',
      providers: ['cursor'],
    },
    isPlanned: false,
    time: timeOf({ label: '2m 40s' }),
    cost: '$0.31',
    action: null,
  },
  {
    id: 'long',
    title: 'Check the retry budget',
    summary: modelsSummary({
      models: [
        modelOf({
          provider: 'anthropic',
          name: 'Claude Sonnet 4.5 Extended Thinking Preview',
          effort: 'Medium',
        }),
      ],
    }),
    isPlanned: false,
    time: timeOf({ label: '1m 05s' }),
    cost: '$0.12',
    action: null,
  },
  {
    id: 'two',
    title: 'Plan the dedupe change',
    summary: modelsSummary({
      models: [
        modelOf({ provider: 'moonshot', name: 'Kimi K3' }),
        modelOf({ provider: 'anthropic', name: 'Sonnet 5.5' }),
      ],
    }),
    isPlanned: false,
    time: timeOf({ label: '7m 30s' }),
    cost: '$1.04',
    action: null,
  },
  {
    id: 'three',
    title: 'Investigate the stale cache',
    summary: modelsSummary({
      models: [
        modelOf({ provider: 'moonshot', name: 'Kimi K3' }),
        modelOf({ provider: 'anthropic', name: 'Sonnet 5.5' }),
        modelOf({ provider: 'codex', name: 'GPT-6.1' }),
      ],
    }),
    isPlanned: false,
    time: timeOf({ label: '12m' }),
    cost: '$2.31',
    action: null,
  },
  {
    id: 'run',
    title: 'Fix the notify-relay backoff',
    summary: modelsSummary({
      isRun: true,
      models: [
        modelOf({ provider: 'anthropic', name: 'Sonnet 5.5', stepCount: 3 }),
        modelOf({ provider: 'codex', name: 'GPT-6.1', stepCount: 1 }),
        modelOf({ provider: 'cursor', name: 'Composer 2', stepCount: 1 }),
        modelOf({ provider: 'moonshot', name: 'Kimi K3', stepCount: 1 }),
        modelOf({ provider: 'anthropic', name: 'Haiku 4.5', stepCount: 2 }),
        modelOf({ provider: 'anthropic', name: 'Opus 5.5', stepCount: 1 }),
      ],
    }),
    isPlanned: false,
    time: timeOf({ label: '31m' }),
    cost: '$6.80',
    action: null,
  },
  {
    id: 'answer',
    title: 'Agree where the dedupe belongs',
    summary: modelsSummary({
      models: [modelOf({ provider: 'anthropic', name: 'Sonnet 5.5', effort: 'High' })],
    }),
    isPlanned: false,
    time: timeOf({ label: '3m 02s' }),
    cost: '$0.40',
    action: 'Answer',
  },
  {
    id: 'none',
    title: 'Open the pull request',
    summary: null,
    isPlanned: false,
    time: timeOf({ label: '20s' }),
    cost: '$0.01',
    action: null,
  },
];
