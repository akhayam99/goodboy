import type { AgentRole, AuxTaskId, EffortLevel, ProviderId } from '@goodboy/types';

export type CuratedProviderId = Extract<ProviderId, 'anthropic' | 'codex' | 'gemini' | 'cursor'>;

export type AutoSlotId = AgentRole | AuxTaskId;

export type AutoChoice = {
  readonly key: string;
  readonly effort?: EffortLevel;
  readonly thinking?: boolean;
};

type Column = Readonly<Record<AutoSlotId, ReadonlyArray<AutoChoice>>>;

const HAIKU: AutoChoice = { key: 'haiku-4.5' };
const HAIKU_LOW: AutoChoice = { key: 'haiku-4.5', effort: 'low' };
const SONNET_LOW: AutoChoice = { key: 'sonnet-5', effort: 'low' };
const SONNET_MEDIUM: AutoChoice = { key: 'sonnet-5', effort: 'medium' };
const SONNET_HIGH: AutoChoice = { key: 'sonnet-5', effort: 'high' };
const SONNET: AutoChoice = { key: 'sonnet-5' };

const ANTHROPIC: Column = {
  scout: [HAIKU_LOW],
  investigator: [SONNET_HIGH],
  planner: [
    { key: 'opus-5.5', effort: 'high' },
    { key: 'opus-5', effort: 'high' },
  ],
  implementer: [SONNET_MEDIUM],
  tester: [SONNET_MEDIUM],
  resolver: [SONNET_MEDIUM],
  reviewer: [SONNET_HIGH],
  docs: [SONNET_LOW],
  report: [SONNET_MEDIUM],
  wireframe: [SONNET_MEDIUM],
  custom: [SONNET_MEDIUM],
  summarizer: [HAIKU],
  plan_generation: [SONNET_MEDIUM],
  prose_polish: [HAIKU],
  agent_naming: [HAIKU],
  issue_brief: [HAIKU],
  workflow_orchestrator: [SONNET_MEDIUM],
  question_delegate: [SONNET_MEDIUM],
  pr_draft: [SONNET],
  rebase: [SONNET],
};

const LUNA_LOW: AutoChoice = { key: 'gpt-5.6-luna', effort: 'low' };
const LUNA_MEDIUM: AutoChoice = { key: 'gpt-5.6-luna', effort: 'medium' };
const TERRA_MEDIUM: AutoChoice = { key: 'gpt-5.6-terra', effort: 'medium' };
const TERRA: AutoChoice = { key: 'gpt-5.6-terra' };
const SOL_MEDIUM: AutoChoice = { key: 'gpt-5.6-sol', effort: 'medium' };
const SOL_HIGH: AutoChoice = { key: 'gpt-5.6-sol', effort: 'high' };

const CODEX: Column = {
  scout: [LUNA_LOW],
  investigator: [SOL_MEDIUM],
  planner: [{ key: 'gpt-6', effort: 'high' }],
  implementer: [SOL_MEDIUM],
  tester: [TERRA_MEDIUM],
  resolver: [TERRA_MEDIUM],
  reviewer: [SOL_HIGH],
  docs: [LUNA_MEDIUM],
  report: [TERRA_MEDIUM],
  wireframe: [TERRA_MEDIUM],
  custom: [TERRA_MEDIUM],
  summarizer: [LUNA_LOW],
  plan_generation: [TERRA_MEDIUM],
  prose_polish: [LUNA_LOW],
  agent_naming: [LUNA_LOW],
  issue_brief: [LUNA_LOW],
  workflow_orchestrator: [TERRA_MEDIUM],
  question_delegate: [TERRA_MEDIUM],
  pr_draft: [TERRA],
  rebase: [TERRA],
};

const FLASH_LOW: AutoChoice = { key: 'gemini-3.8-flash', effort: 'low' };
const FLASH_MEDIUM: AutoChoice = { key: 'gemini-3.8-flash', effort: 'medium' };
const FLASH: AutoChoice = { key: 'gemini-3.8-flash' };
const PRO_LOW: AutoChoice = { key: 'gemini-3.1-pro', effort: 'low' };
const PRO_HIGH: AutoChoice = { key: 'gemini-3.1-pro', effort: 'high' };
const PRO: AutoChoice = { key: 'gemini-3.1-pro' };

const GEMINI: Column = {
  scout: [FLASH_LOW],
  investigator: [PRO_HIGH],
  planner: [PRO_HIGH],
  implementer: [PRO_LOW],
  tester: [PRO_LOW],
  resolver: [PRO_LOW],
  reviewer: [PRO_HIGH],
  docs: [FLASH_MEDIUM],
  report: [PRO_LOW],
  wireframe: [PRO_LOW],
  custom: [PRO_LOW],
  summarizer: [FLASH_LOW],
  plan_generation: [PRO_LOW],
  prose_polish: [FLASH_LOW],
  agent_naming: [FLASH_LOW],
  issue_brief: [FLASH_LOW],
  workflow_orchestrator: [PRO_LOW],
  question_delegate: [PRO_LOW],
  pr_draft: [FLASH],
  rebase: [PRO],
};

const AUTO: AutoChoice = { key: 'auto' };
const COMPOSER: AutoChoice = { key: 'composer-2.5' };
const SONNET_THINKING: AutoChoice = { key: 'sonnet-4.6', effort: 'medium', thinking: true };

const CURSOR: Column = {
  scout: [AUTO],
  investigator: [SONNET_THINKING],
  planner: [SONNET_THINKING],
  implementer: [COMPOSER],
  tester: [COMPOSER],
  resolver: [COMPOSER],
  reviewer: [SONNET_THINKING],
  docs: [COMPOSER],
  report: [COMPOSER],
  wireframe: [COMPOSER],
  custom: [COMPOSER],
  summarizer: [AUTO],
  plan_generation: [COMPOSER],
  prose_polish: [AUTO],
  agent_naming: [AUTO],
  issue_brief: [AUTO],
  workflow_orchestrator: [COMPOSER],
  question_delegate: [COMPOSER],
  pr_draft: [AUTO],
  rebase: [COMPOSER],
};

export const AUTO_DEFAULTS: Readonly<Record<CuratedProviderId, Column>> = {
  anthropic: ANTHROPIC,
  codex: CODEX,
  gemini: GEMINI,
  cursor: CURSOR,
};

export const isCuratedProvider = (provider: ProviderId): provider is CuratedProviderId =>
  provider in AUTO_DEFAULTS;
