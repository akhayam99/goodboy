import type { AgentRole, AuxTaskId, CatalogModel, EffortLevel, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from '../catalogs';
import { latestInGroup, type ModelLine } from '../latestInGroup';
import { modelHasEffortAxis } from '../modelHasEffortAxis';

export type CuratedProviderId = Extract<ProviderId, 'anthropic' | 'codex' | 'gemini' | 'cursor'>;

export type AutoSlotId = AgentRole | AuxTaskId;

export type AutoChoice = {
  readonly key: string;
  readonly effort?: EffortLevel;
  readonly thinking?: boolean;
};

type JobShape = {
  readonly effort?: EffortLevel;
  readonly thinking?: boolean;
};

export type AutoLineJob = JobShape & ModelLine;

export type AutoPinnedJob = JobShape & {
  readonly key: string;
  readonly pinnedBecause: string;
};

export type AutoJob = AutoLineJob | AutoPinnedJob;

type JobColumn = Readonly<Record<AutoSlotId, ReadonlyArray<AutoJob>>>;

type Column = Readonly<Record<AutoSlotId, ReadonlyArray<AutoChoice>>>;

const HAIKU: AutoJob = { group: 'Haiku' };
const HAIKU_LOW: AutoJob = { group: 'Haiku', effort: 'low' };
const SONNET_LOW: AutoJob = { group: 'Sonnet', effort: 'low' };
const SONNET_MEDIUM: AutoJob = { group: 'Sonnet', effort: 'medium' };
const SONNET_HIGH: AutoJob = { group: 'Sonnet', effort: 'high' };
const SONNET: AutoJob = { group: 'Sonnet' };
const OPUS_HIGH: AutoJob = { group: 'Opus', effort: 'high' };

const ANTHROPIC: JobColumn = {
  scout: [HAIKU_LOW],
  investigator: [SONNET_HIGH],
  planner: [OPUS_HIGH],
  implementer: [SONNET_MEDIUM],
  tester: [SONNET_MEDIUM],
  resolver: [SONNET_MEDIUM],
  rewriter: [SONNET],
  scribe: [SONNET],
  reviewer: [SONNET_HIGH],
  docs: [SONNET_LOW],
  report: [SONNET_MEDIUM],
  wireframe: [SONNET_MEDIUM],
  custom: [SONNET_MEDIUM],
  summarizer: [HAIKU],
  learnings: [HAIKU],
  plan_generation: [SONNET_MEDIUM],
  prose_polish: [HAIKU],
  agent_naming: [HAIKU],
  issue_brief: [HAIKU],
  workflow_orchestrator: [SONNET_MEDIUM],
  question_delegate: [SONNET_MEDIUM],
  pr_draft: [SONNET],
  rebase: [SONNET],
  recheck: [HAIKU],
};

const LUNA_LOW: AutoJob = { group: 'GPT', checkpoint: 'Luna', effort: 'low' };
const LUNA_MEDIUM: AutoJob = { group: 'GPT', checkpoint: 'Luna', effort: 'medium' };
const TERRA_MEDIUM: AutoJob = { group: 'GPT', checkpoint: 'Terra', effort: 'medium' };
const TERRA: AutoJob = { group: 'GPT', checkpoint: 'Terra' };
const SOL_MEDIUM: AutoJob = { group: 'GPT', checkpoint: 'Sol', effort: 'medium' };
const SOL_HIGH: AutoJob = { group: 'GPT', checkpoint: 'Sol', effort: 'high' };
const ASTRA_HIGH: AutoJob = { group: 'GPT', checkpoint: 'Astra', effort: 'high' };

const CODEX: JobColumn = {
  scout: [LUNA_LOW],
  investigator: [SOL_MEDIUM],
  planner: [ASTRA_HIGH],
  implementer: [SOL_MEDIUM],
  tester: [TERRA_MEDIUM],
  resolver: [TERRA_MEDIUM],
  rewriter: [TERRA],
  scribe: [TERRA],
  reviewer: [SOL_HIGH],
  docs: [LUNA_MEDIUM],
  report: [TERRA_MEDIUM],
  wireframe: [TERRA_MEDIUM],
  custom: [TERRA_MEDIUM],
  summarizer: [LUNA_LOW],
  learnings: [LUNA_LOW],
  plan_generation: [TERRA_MEDIUM],
  prose_polish: [LUNA_LOW],
  agent_naming: [LUNA_LOW],
  issue_brief: [LUNA_LOW],
  workflow_orchestrator: [TERRA_MEDIUM],
  question_delegate: [TERRA_MEDIUM],
  pr_draft: [TERRA],
  rebase: [TERRA],
  recheck: [LUNA_LOW],
};

const FLASH_LOW: AutoJob = { group: 'Gemini', checkpoint: 'Flash', effort: 'low' };
const FLASH_MEDIUM: AutoJob = { group: 'Gemini', checkpoint: 'Flash', effort: 'medium' };
const FLASH: AutoJob = { group: 'Gemini', checkpoint: 'Flash' };
const PRO_LOW: AutoJob = { group: 'Gemini', checkpoint: 'Pro', effort: 'low' };
const PRO_HIGH: AutoJob = { group: 'Gemini', checkpoint: 'Pro', effort: 'high' };
const PRO: AutoJob = { group: 'Gemini', checkpoint: 'Pro' };

const GEMINI: JobColumn = {
  scout: [FLASH_LOW],
  investigator: [PRO_HIGH],
  planner: [PRO_HIGH],
  implementer: [PRO_LOW],
  tester: [PRO_LOW],
  resolver: [PRO_LOW],
  rewriter: [PRO],
  scribe: [FLASH],
  reviewer: [PRO_HIGH],
  docs: [FLASH_MEDIUM],
  report: [PRO_LOW],
  wireframe: [PRO_LOW],
  custom: [PRO_LOW],
  summarizer: [FLASH_LOW],
  learnings: [FLASH_LOW],
  plan_generation: [PRO_LOW],
  prose_polish: [FLASH_LOW],
  agent_naming: [FLASH_LOW],
  issue_brief: [FLASH_LOW],
  workflow_orchestrator: [PRO_LOW],
  question_delegate: [PRO_LOW],
  pr_draft: [FLASH],
  rebase: [PRO],
  recheck: [FLASH_LOW],
};

const AUTO: AutoJob = { group: 'Auto' };
const COMPOSER: AutoJob = { group: 'Composer' };
const SONNET_THINKING: AutoJob = {
  key: 'sonnet-4.6',
  effort: 'medium',
  thinking: true,
  pinnedBecause:
    'Newer Sonnet thinking combos need Max Mode on Cursor and the newest Sonnet has no thinking combo. Held until a cursor-agent probe says quality and cost.',
};

const CURSOR: JobColumn = {
  scout: [AUTO],
  investigator: [SONNET_THINKING],
  planner: [SONNET_THINKING],
  implementer: [COMPOSER],
  tester: [COMPOSER],
  resolver: [COMPOSER],
  rewriter: [COMPOSER],
  scribe: [AUTO],
  reviewer: [SONNET_THINKING],
  docs: [COMPOSER],
  report: [COMPOSER],
  wireframe: [COMPOSER],
  custom: [COMPOSER],
  summarizer: [AUTO],
  learnings: [AUTO],
  plan_generation: [COMPOSER],
  prose_polish: [AUTO],
  agent_naming: [AUTO],
  issue_brief: [AUTO],
  workflow_orchestrator: [COMPOSER],
  question_delegate: [COMPOSER],
  pr_draft: [AUTO],
  rebase: [COMPOSER],
  recheck: [AUTO],
};

export const AUTO_JOBS: Readonly<Record<CuratedProviderId, JobColumn>> = {
  anthropic: ANTHROPIC,
  codex: CODEX,
  gemini: GEMINI,
  cursor: CURSOR,
};

export const isPinnedJob = (job: AutoJob): job is AutoPinnedJob => 'pinnedBecause' in job;

type OffersParams = {
  readonly model: CatalogModel;
  readonly job: AutoJob;
};

const offersJob = ({ model, job }: OffersParams): boolean => {
  if (model.provider === 'cursor') {
    return model.combos.some(
      (combo) =>
        combo.thinking === (job.thinking === true) &&
        (job.effort == null || combo.effort === job.effort),
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
  ...(job.thinking === true && { thinking: true }),
});

export const expandAutoJob = ({ provider, job }: ExpandParams): ReadonlyArray<AutoChoice> => {
  if (isPinnedJob(job)) {
    const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
    return catalog.some((model) => model.key === job.key) ? [choiceOf({ key: job.key, job })] : [];
  }
  return latestInGroup({ provider, group: job.group, checkpoint: job.checkpoint })
    .filter((model) => offersJob({ model, job }))
    .map((model) => choiceOf({ key: model.key, job }));
};

type ColumnParams = {
  readonly provider: CuratedProviderId;
  readonly jobs: JobColumn;
};

const SLOT_IDS: ReadonlyArray<AutoSlotId> = Object.keys(ANTHROPIC).filter(
  (id): id is AutoSlotId => id in ANTHROPIC,
);

const isColumn = (value: Readonly<Record<string, ReadonlyArray<AutoChoice>>>): value is Column =>
  SLOT_IDS.every((slot) => value[slot] != null);

const expandColumn = ({ provider, jobs }: ColumnParams): Column => {
  const expanded: Record<string, ReadonlyArray<AutoChoice>> = Object.fromEntries(
    SLOT_IDS.map((slot) => {
      const choices = jobs[slot].flatMap((job) => expandAutoJob({ provider, job }));
      const unique = choices.filter(
        (choice, index) => choices.findIndex((other) => other.key === choice.key) === index,
      );
      return [slot, unique];
    }),
  );
  if (!isColumn(expanded)) {
    throw new Error(`auto column for ${provider} misses a slot`);
  }
  return expanded;
};

export const AUTO_DEFAULTS: Readonly<Record<CuratedProviderId, Column>> = {
  anthropic: expandColumn({ provider: 'anthropic', jobs: ANTHROPIC }),
  codex: expandColumn({ provider: 'codex', jobs: CODEX }),
  gemini: expandColumn({ provider: 'gemini', jobs: GEMINI }),
  cursor: expandColumn({ provider: 'cursor', jobs: CURSOR }),
};

export const isCuratedProvider = (provider: ProviderId): provider is CuratedProviderId =>
  provider in AUTO_DEFAULTS;
