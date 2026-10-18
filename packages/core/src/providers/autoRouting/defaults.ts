import type { CatalogModel, ProviderId } from '@goodboy/types';
import { latestInGroup } from '../latestInGroup';
import { modelHasEffortAxis } from '../modelHasEffortAxis';
import type { AutoChoice, AutoJob, AutoSlotId, CuratedProviderId } from './autoJob';
import { EFFORT_LADDER, type Rung } from './effortLadder';
import { SLOT_RUNGS } from './slotRungs';

export type { AutoChoice, AutoJob, AutoSlotId, CuratedProviderId } from './autoJob';

type JobColumn = Readonly<Record<AutoSlotId, ReadonlyArray<AutoJob>>>;

type Column = Readonly<Record<AutoSlotId, ReadonlyArray<AutoChoice>>>;

const CURATED_PROVIDERS: ReadonlyArray<CuratedProviderId> = [
  'anthropic',
  'codex',
  'gemini',
  'cursor',
];

const SLOT_IDS: ReadonlyArray<AutoSlotId> = Object.keys(SLOT_RUNGS).filter(
  (id): id is AutoSlotId => id in SLOT_RUNGS,
);

type OffersParams = {
  readonly model: CatalogModel;
  readonly job: AutoJob;
};

const offersJob = ({ model, job }: OffersParams): boolean => {
  if (model.provider === 'cursor') {
    return model.combos.some(
      (combo) => combo.thinking === false && (job.effort == null || combo.effort === job.effort),
    );
  }
  if (job.effort == null || !modelHasEffortAxis({ model })) {
    return true;
  }
  return model.efforts.includes(job.effort);
};

type ExpandParams = {
  readonly provider: CuratedProviderId;
  readonly job: AutoJob;
};

type ChoiceParams = {
  readonly key: string;
  readonly job: AutoJob;
};

const choiceOf = ({ key, job }: ChoiceParams): AutoChoice => ({
  key,
  ...(job.effort != null && { effort: job.effort }),
});

export const expandAutoJob = ({ provider, job }: ExpandParams): ReadonlyArray<AutoChoice> =>
  latestInGroup({ provider, group: job.group, checkpoint: job.checkpoint })
    .filter((model) => offersJob({ model, job }))
    .map((model) => choiceOf({ key: model.key, job }));

type RungChoicesParams = {
  readonly provider: CuratedProviderId;
  readonly rung: Rung;
};

const expandRung = ({ provider, rung }: RungChoicesParams): ReadonlyArray<AutoChoice> => {
  const choices = EFFORT_LADDER[provider][rung].flatMap((job) => expandAutoJob({ provider, job }));
  return choices.filter(
    (choice, index) => choices.findIndex((other) => other.key === choice.key) === index,
  );
};

type ProviderRungs = Readonly<Record<Rung, ReadonlyArray<AutoChoice>>>;

const expandProvider = (provider: CuratedProviderId): ProviderRungs => ({
  quick: expandRung({ provider, rung: 'quick' }),
  light: expandRung({ provider, rung: 'light' }),
  standard: expandRung({ provider, rung: 'standard' }),
  hard: expandRung({ provider, rung: 'hard' }),
  top: expandRung({ provider, rung: 'top' }),
});

export const AUTO_RUNG_CHOICES: Readonly<Record<CuratedProviderId, ProviderRungs>> = {
  anthropic: expandProvider('anthropic'),
  codex: expandProvider('codex'),
  gemini: expandProvider('gemini'),
  cursor: expandProvider('cursor'),
};

const isJobColumn = (value: Readonly<Record<string, ReadonlyArray<AutoJob>>>): value is JobColumn =>
  SLOT_IDS.every((slot) => value[slot] != null);

const isColumn = (value: Readonly<Record<string, ReadonlyArray<AutoChoice>>>): value is Column =>
  SLOT_IDS.every((slot) => value[slot] != null);

const jobColumnOf = (provider: CuratedProviderId): JobColumn => {
  const jobs = Object.fromEntries(
    SLOT_IDS.map((slot) => [slot, EFFORT_LADDER[provider][SLOT_RUNGS[slot].normal]]),
  );
  if (!isJobColumn(jobs)) {
    throw new Error(`auto jobs for ${provider} miss a slot`);
  }
  return jobs;
};

export const AUTO_JOBS: Readonly<Record<CuratedProviderId, JobColumn>> = {
  anthropic: jobColumnOf('anthropic'),
  codex: jobColumnOf('codex'),
  gemini: jobColumnOf('gemini'),
  cursor: jobColumnOf('cursor'),
};

const columnOf = (provider: CuratedProviderId): Column => {
  const choices = Object.fromEntries(
    SLOT_IDS.map((slot) => [slot, AUTO_RUNG_CHOICES[provider][SLOT_RUNGS[slot].normal]]),
  );
  if (!isColumn(choices)) {
    throw new Error(`auto column for ${provider} misses a slot`);
  }
  return choices;
};

export const AUTO_DEFAULTS: Readonly<Record<CuratedProviderId, Column>> = {
  anthropic: columnOf('anthropic'),
  codex: columnOf('codex'),
  gemini: columnOf('gemini'),
  cursor: columnOf('cursor'),
};

export const isCuratedProvider = (provider: ProviderId): provider is CuratedProviderId =>
  CURATED_PROVIDERS.some((curated) => curated === provider);
