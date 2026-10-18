import type { StepSize } from '@goodboy/types';
import type { AutoSlotId } from './autoJob';
import type { AutoSlot } from './autoTypes';
import type { Rung } from './effortLadder';

type SlotRung = {
  readonly small: Rung;
  readonly normal: Rung;
  readonly large: Rung;
};

type FixedParams = {
  readonly rung: Rung;
};

const fixed = ({ rung }: FixedParams): SlotRung => ({ small: rung, normal: rung, large: rung });

const LIGHT_READER: SlotRung = { small: 'light', normal: 'light', large: 'standard' };
const BUILDER: SlotRung = { small: 'light', normal: 'standard', large: 'hard' };
const WRITER: SlotRung = { small: 'standard', normal: 'standard', large: 'hard' };
const CHECKER: SlotRung = { small: 'standard', normal: 'hard', large: 'top' };

export const SLOT_RUNGS: Readonly<Record<AutoSlotId, SlotRung>> = {
  scout: LIGHT_READER,
  investigator: CHECKER,
  planner: { small: 'hard', normal: 'top', large: 'top' },
  implementer: BUILDER,
  tester: BUILDER,
  resolver: BUILDER,
  'ci-fixer': BUILDER,
  reviewer: CHECKER,
  'ci-debugger': CHECKER,
  docs: LIGHT_READER,
  scribe: LIGHT_READER,
  rewriter: WRITER,
  report: WRITER,
  wireframe: WRITER,
  auto: fixed({ rung: 'standard' }),
  custom: fixed({ rung: 'standard' }),
  summarizer: fixed({ rung: 'quick' }),
  learnings: fixed({ rung: 'quick' }),
  plan_generation: fixed({ rung: 'standard' }),
  prose_polish: fixed({ rung: 'quick' }),
  agent_naming: fixed({ rung: 'quick' }),
  issue_brief: fixed({ rung: 'quick' }),
  workflow_orchestrator: fixed({ rung: 'standard' }),
  question_delegate: fixed({ rung: 'standard' }),
  pr_draft: fixed({ rung: 'light' }),
  rebase: fixed({ rung: 'standard' }),
  recheck: fixed({ rung: 'light' }),
};

type LowestParams = {
  readonly slot: AutoSlot;
};

export const lowestRungOf = ({ slot }: LowestParams): Rung => {
  if (slot.kind === 'task') {
    return 'quick';
  }
  return slot.id === 'planner' ? 'hard' : 'light';
};

type RungParams = {
  readonly slot: AutoSlotId;
  readonly size?: StepSize | null;
};

export const rungForStep = ({ slot, size }: RungParams): Rung => {
  const rungs = SLOT_RUNGS[slot];
  if (size === 'small') {
    return rungs.small;
  }
  if (size === 'large') {
    return rungs.large;
  }
  return rungs.normal;
};

export const isSizeMovingRung = ({ slot, size }: RungParams): boolean =>
  rungForStep({ slot, size }) !== rungForStep({ slot, size: null });
