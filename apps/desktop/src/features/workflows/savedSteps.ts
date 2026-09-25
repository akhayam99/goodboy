import { BUILTIN_STEPS } from '@goodboy/core';
import type {
  AgentRole,
  EffortLevel,
  ProviderId,
  StepDef,
  StepDefId,
  VerbosityLevel,
  WorkspaceId,
} from '@goodboy/types';
import type { StepDraft } from './engine';
import type { StepDefUpsertArgs } from './workflows';

export type SavedStep = {
  readonly id: StepDefId;
  readonly role: AgentRole;
  readonly name: string;
  readonly promptPrefix: string;
  readonly expectedOutput: string;
  readonly isBuiltin: boolean;
  readonly baseStepId: StepDefId | null;
  readonly providerDefault: ProviderId | null;
  readonly modelDefault: string | null;
  readonly effortDefault: EffortLevel | null;
  readonly verbosityDefault: VerbosityLevel | null;
};

export type SavedStepGroups = {
  readonly builtin: ReadonlyArray<SavedStep>;
  readonly workspace: ReadonlyArray<SavedStep>;
};

const DEFAULT_EFFORT: EffortLevel = 'medium';

const BUILTIN_SAVED_STEPS: ReadonlyArray<SavedStep> = BUILTIN_STEPS.map((step) => ({
  id: step.id,
  role: step.role,
  name: step.name,
  promptPrefix: step.promptPrefix,
  expectedOutput: step.expectedOutput,
  isBuiltin: true,
  baseStepId: null,
  providerDefault: null,
  modelDefault: null,
  effortDefault: null,
  verbosityDefault: null,
}));

type FromDefParams = {
  readonly def: StepDef;
};

const savedStepFromDef = ({ def }: FromDefParams): SavedStep => ({
  id: def.id,
  role: def.role,
  name: def.name,
  promptPrefix: def.promptPrefix,
  expectedOutput: def.expectedOutput ?? '',
  isBuiltin: false,
  baseStepId: def.baseStepId ?? null,
  providerDefault: def.providerDefault ?? null,
  modelDefault: def.modelDefault ?? null,
  effortDefault: def.effortDefault ?? null,
  verbosityDefault: def.verbosityDefault ?? null,
});

type GroupsParams = {
  readonly defs: ReadonlyArray<StepDef>;
};

export const savedStepGroups = ({ defs }: GroupsParams): SavedStepGroups => ({
  builtin: BUILTIN_SAVED_STEPS,
  workspace: defs.map((def) => savedStepFromDef({ def })),
});

type NoteParams = {
  readonly step: SavedStep;
  readonly groups: SavedStepGroups;
};

const firstLine = (text: string): string => text.trim().split('\n')[0]?.trim() ?? '';

export const baseStepName = ({ step, groups }: NoteParams): string | null => {
  if (step.baseStepId === null) {
    return null;
  }
  const base = [...groups.builtin, ...groups.workspace].find(
    (candidate) => candidate.id === step.baseStepId,
  );
  return base === undefined ? null : base.name;
};

export const savedStepNote = ({ step, groups }: NoteParams): string => {
  const base = baseStepName({ step, groups });
  const line = firstLine(step.promptPrefix);
  if (base === null) {
    return line;
  }
  return line === '' ? `Based on ${base}` : `Based on ${base} · ${line}`;
};

type DraftParams = {
  readonly step: SavedStep;
};

export const stepDraftFromSavedStep = ({ step }: DraftParams): StepDraft => ({
  key: crypto.randomUUID(),
  sourceStepId: null,
  libraryStepId: step.id,
  role: step.role,
  name: step.name,
  prompt: step.promptPrefix,
  expectedOutput: step.expectedOutput,
  provider: step.providerDefault ?? '',
  model: step.modelDefault ?? '',
  effort: step.effortDefault ?? DEFAULT_EFFORT,
  verbosity: step.verbosityDefault ?? 'normal',
  size: null,
});

type ArgsParams = {
  readonly draft: StepDraft;
  readonly workspaceId: WorkspaceId;
  readonly id?: StepDefId;
  readonly baseStepId: StepDefId | null;
};

export const stepDefArgsFromDraft = ({
  draft,
  workspaceId,
  id,
  baseStepId,
}: ArgsParams): StepDefUpsertArgs => ({
  ...(id !== undefined && { id }),
  workspaceId,
  ...(baseStepId !== null && { baseStepId }),
  role: draft.role,
  name: draft.name.trim(),
  promptPrefix: draft.prompt,
  ...(draft.expectedOutput.trim() !== '' && { expectedOutput: draft.expectedOutput.trim() }),
  ...(draft.provider !== '' && { providerDefault: draft.provider }),
  ...(draft.model.trim() !== '' && { modelDefault: draft.model.trim() }),
  effortDefault: draft.effort,
  verbosityDefault: draft.verbosity,
});
