import type { ProviderRule } from '@goodboy/core/providers';

type NameParams = {
  readonly name: string;
};

type OnParams = {
  readonly name: string;
  readonly provider: string;
};

type RuleCopy = Readonly<Record<ProviderRule, string>>;

const HELPERS: RuleCopy = {
  order: 'the Lead picks helpers, by order',
  load: 'the Lead picks helpers, by load',
};

export const RUN_MODEL_COPY = {
  onProvider: ({ name, provider }: OnParams) => `${name} on ${provider}`,
  helpers: HELPERS,
  change: 'Change',
  changeLabel: ({ name }: NameParams) => `Change the ${name} model for this run`,
  whereItRuns: 'Where it runs',
  label: 'Model',
  orchestrator: 'Orchestrator',
  pinned: 'pinned',
  auto: 'Auto',
  reason: 'The default from Settings. A pick here is for this run only.',
  changeDefault: 'Change the default in Every run',
  forThisRun: ({ name }: NameParams) => `${name} model`,
} as const;
