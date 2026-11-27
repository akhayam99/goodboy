import { clippedTextOf, isRecord } from '@goodboy/types/helpers';
import type { AutoRefusalCode } from './refusals';
import { isAutoWriterRole, parseAutoDelegationRole } from './roles';

export const GUIDE_CHECKS = ['pending', 'passed', 'held', 'continued'] as const;

export type GuideCheck = (typeof GUIDE_CHECKS)[number];

export const GUIDE_CHANGES = ['added', 'skipped', 'moved'] as const;

export type GuideChange = (typeof GUIDE_CHANGES)[number];

export type GuideStep = Readonly<{
  name: string;
  role: string | null;
}>;

export type GuideChoice = Readonly<{
  id: string;
  name: string;
}>;

export type GuideDeviation = Readonly<{
  change: GuideChange;
  step: string;
  reason: string;
}>;

export type GuideRecord = Readonly<{
  workflowId: string;
  name: string;
  entryCheck: string;
  stopRule: string;
  suggestion: GuideChoice | null;
  isOrderKept: boolean;
  steps: ReadonlyArray<GuideStep>;
  choices: ReadonlyArray<GuideChoice>;
  check: GuideCheck;
  checkNote: string;
  holdReason: string;
  holdSuggestion: GuideChoice | null;
  deviations: ReadonlyArray<GuideDeviation>;
}>;

export const GUIDE_TEXT_CHARS = 400;
export const GUIDE_STEPS_MAX = 12;
export const GUIDE_CHOICES_MAX = 8;
export const GUIDE_DEVIATIONS_MAX = 20;
export const GUIDE_SECTION_CHARS = 2_400;

export const GUIDE_FOLLOW_SHAPE =
  '{"action":"follow","check":"<what you checked and what you saw, one line>"}';

export const GUIDE_HOLD_SHAPE =
  '{"action":"hold","reason":"<why the run stops, one line>","suggest":"<name of a workflow from the list, or null>"}';

export const GUIDE_DEVIATE_SHAPE = `{"action":"deviate","change":"${GUIDE_CHANGES.join('|')}","step":"<step name>","reason":"<one line>"}`;

type RecordParams = {
  readonly guide: GuideRecord;
};

type ChoiceParams = {
  readonly value: unknown;
};

const guideChoiceOfValue = ({ value }: ChoiceParams): GuideChoice | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = clippedTextOf({ value: value['id'], max: GUIDE_TEXT_CHARS });
  const name = clippedTextOf({ value: value['name'], max: GUIDE_TEXT_CHARS });
  return id === null || name === null ? null : { id, name };
};

type ListParams = {
  readonly value: unknown;
};

const guideListOfValue = ({ value }: ListParams): ReadonlyArray<unknown> =>
  Array.isArray(value) ? value : [];

const guideStepOfValue = ({ value }: ChoiceParams): GuideStep | null => {
  if (!isRecord(value)) {
    return null;
  }
  const name = clippedTextOf({ value: value['name'], max: GUIDE_TEXT_CHARS });
  if (name === null) {
    return null;
  }
  return { name, role: clippedTextOf({ value: value['role'], max: GUIDE_TEXT_CHARS }) };
};

const deviationOf = ({ value }: ChoiceParams): GuideDeviation | null => {
  if (!isRecord(value)) {
    return null;
  }
  const change = GUIDE_CHANGES.find((candidate) => candidate === value['change']);
  const step = clippedTextOf({ value: value['step'], max: GUIDE_TEXT_CHARS });
  const reason = clippedTextOf({ value: value['reason'], max: GUIDE_TEXT_CHARS });
  return change === undefined || step === null || reason === null ? null : { change, step, reason };
};

type NonNullParams<Item> = {
  readonly items: ReadonlyArray<Item | null>;
};

const presentOf = <Item>({ items }: NonNullParams<Item>): ReadonlyArray<Item> =>
  items.filter((item): item is Item => item !== null);

type ParseParams = {
  readonly raw: string | null;
};

export const parseGuideRecord = ({ raw }: ParseParams): GuideRecord | null => {
  if (raw === null || raw === '') {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const workflowId = clippedTextOf({ value: parsed['workflowId'], max: GUIDE_TEXT_CHARS });
  const name = clippedTextOf({ value: parsed['name'], max: GUIDE_TEXT_CHARS });
  const check = GUIDE_CHECKS.find((candidate) => candidate === parsed['check']);
  if (workflowId === null || name === null || check === undefined) {
    return null;
  }
  return {
    workflowId,
    name,
    entryCheck: clippedTextOf({ value: parsed['entryCheck'], max: GUIDE_TEXT_CHARS }) ?? '',
    stopRule: clippedTextOf({ value: parsed['stopRule'], max: GUIDE_TEXT_CHARS }) ?? '',
    suggestion: guideChoiceOfValue({ value: parsed['suggestion'] }),
    isOrderKept: parsed['isOrderKept'] === true,
    steps: presentOf({
      items: guideListOfValue({ value: parsed['steps'] }).map((value) =>
        guideStepOfValue({ value }),
      ),
    }).slice(0, GUIDE_STEPS_MAX),
    choices: presentOf({
      items: guideListOfValue({ value: parsed['choices'] }).map((value) =>
        guideChoiceOfValue({ value }),
      ),
    }).slice(0, GUIDE_CHOICES_MAX),
    check,
    checkNote: clippedTextOf({ value: parsed['checkNote'], max: GUIDE_TEXT_CHARS }) ?? '',
    holdReason: clippedTextOf({ value: parsed['holdReason'], max: GUIDE_TEXT_CHARS }) ?? '',
    holdSuggestion: guideChoiceOfValue({ value: parsed['holdSuggestion'] }),
    deviations: presentOf({
      items: guideListOfValue({ value: parsed['deviations'] }).map((value) =>
        deviationOf({ value }),
      ),
    }).slice(0, GUIDE_DEVIATIONS_MAX),
  };
};

export const serializeGuideRecord = ({ guide }: RecordParams): string => JSON.stringify(guide);

type StartParams = {
  readonly workflowId: string;
  readonly name: string;
  readonly entryCheck: string;
  readonly stopRule: string;
  readonly suggestion: GuideChoice | null;
  readonly isOrderKept: boolean;
  readonly steps: ReadonlyArray<GuideStep>;
  readonly choices: ReadonlyArray<GuideChoice>;
  readonly isUnderway: boolean;
};

type ClipParams = {
  readonly value: string;
};

const clippedGuideText = ({ value }: ClipParams): string => value.trim().slice(0, GUIDE_TEXT_CHARS);

export const startGuideRecord = ({
  workflowId,
  name,
  entryCheck,
  stopRule,
  suggestion,
  isOrderKept,
  steps,
  choices,
  isUnderway,
}: StartParams): GuideRecord => {
  const check = clippedGuideText({ value: entryCheck });
  const stop = clippedGuideText({ value: stopRule });
  return {
    workflowId,
    name: clippedGuideText({ value: name }),
    entryCheck: check,
    stopRule: stop,
    suggestion,
    isOrderKept,
    steps: steps
      .slice(0, GUIDE_STEPS_MAX)
      .map((step) => ({ ...step, name: clippedGuideText({ value: step.name }) })),
    choices: choices.slice(0, GUIDE_CHOICES_MAX),
    check: isUnderway || (check === '' && stop === '') ? 'passed' : 'pending',
    checkNote: '',
    holdReason: '',
    holdSuggestion: null,
    deviations: [],
  };
};

type FollowParams = {
  readonly guide: GuideRecord;
  readonly note: string;
};

export const followedGuide = ({ guide, note }: FollowParams): GuideRecord =>
  guide.check === 'pending'
    ? { ...guide, check: 'passed', checkNote: clippedGuideText({ value: note }) }
    : guide;

type HoldParams = {
  readonly guide: GuideRecord;
  readonly reason: string;
  readonly suggest: string | null;
};

export const guideChoiceNamed = ({
  guide,
  suggest,
}: Pick<HoldParams, 'guide' | 'suggest'>): GuideChoice | null => {
  const wanted = suggest?.trim().toLowerCase() ?? '';
  if (wanted === '') {
    return null;
  }
  return (
    guide.choices.find(
      (choice) => choice.id.toLowerCase() === wanted || choice.name.toLowerCase() === wanted,
    ) ?? null
  );
};

export const heldGuide = ({ guide, reason, suggest }: HoldParams): GuideRecord => ({
  ...guide,
  check: 'held',
  holdReason: clippedGuideText({ value: reason }),
  holdSuggestion: guideChoiceNamed({ guide, suggest }),
});

type DeviateParams = {
  readonly guide: GuideRecord;
  readonly deviation: GuideDeviation;
};

export const deviatedGuide = ({ guide, deviation }: DeviateParams): GuideRecord => {
  const clipped = {
    change: deviation.change,
    step: clippedGuideText({ value: deviation.step }),
    reason: clippedGuideText({ value: deviation.reason }),
  };
  const isKnown = guide.deviations.some(
    (entry) =>
      entry.change === clipped.change &&
      entry.step === clipped.step &&
      entry.reason === clipped.reason,
  );
  return isKnown || guide.deviations.length >= GUIDE_DEVIATIONS_MAX
    ? guide
    : { ...guide, deviations: [...guide.deviations, clipped] };
};

type GateParams = {
  readonly guide: GuideRecord | null;
  readonly roles: ReadonlyArray<string | null>;
};

export type GuideGate = Readonly<{
  code: Extract<AutoRefusalCode, 'check_pending' | 'held'>;
  slots: ReadonlyArray<number>;
}>;

export const guideGateOf = ({ guide, roles }: GateParams): GuideGate | null => {
  if (guide === null) {
    return null;
  }
  if (guide.check === 'held') {
    return { code: 'held', slots: [] };
  }
  if (guide.check !== 'pending') {
    return null;
  }
  const slots = roles.flatMap((value, slot) => {
    const role = parseAutoDelegationRole({ role: value });
    return role !== null && isAutoWriterRole({ role }) ? [slot] : [];
  });
  return slots.length === 0 ? null : { code: 'check_pending', slots };
};

const STATE_LINE = {
  pending:
    'The first check is not reported. Do it now, from what you have or with a scout. Until you send a follow block, writers are refused. When the check fails, or the stop rule applies, send a hold block instead.',
  passed:
    'The first check passed. Go on with the steps and send a deviate block each time you add, skip or move one.',
  held: 'You stopped this run with a hold block. Start nothing until the user answers.',
  continued:
    'You stopped this run and the user chose to continue. Go on with the steps and send a deviate block each time you add, skip or move one.',
} as const satisfies Readonly<Record<GuideCheck, string>>;

const ORDER_LINE = {
  kept: 'Keep these steps in this order. Ask the user before you add, skip or move one.',
  adapt:
    'The steps are the usual plan, not a pipeline. You may add, skip or move one when the work asks for it.',
} as const;

type OptionalParams = {
  readonly label: string;
  readonly value: string;
};

const optional = ({ label, value }: OptionalParams): ReadonlyArray<string> =>
  value === '' ? [] : [`${label}: ${value}`];

export const guideSectionOf = ({ guide }: RecordParams): string => {
  const steps = guide.steps.map(
    (step, index) => `${index + 1}. ${step.name}${step.role === null ? '' : ` (${step.role})`}`,
  );
  const suggestion = guide.suggestion === null ? [] : [`Then suggest: ${guide.suggestion.name}`];
  const choices =
    guide.choices.length === 0
      ? []
      : [`Workflows you may suggest in a hold: ${guide.choices.map((c) => c.name).join(', ')}.`];
  return [
    'WORKFLOW FOR THIS RUN',
    `You follow the workflow "${guide.name}".`,
    ...optional({ label: 'First, check', value: guide.entryCheck }),
    ...optional({ label: 'Stop and ask when', value: guide.stopRule }),
    ...suggestion,
    ...(steps.length === 0 ? [] : ['Usual steps:', ...steps]),
    guide.isOrderKept ? ORDER_LINE.kept : ORDER_LINE.adapt,
    STATE_LINE[guide.check],
    ...choices,
    `- Follow: report the first check once. Write it before your last block.\n  <<auto>>${GUIDE_FOLLOW_SHAPE}<</auto>>`,
    `- Hold: the check failed or the stop rule applies. Write the reason in plain words, name the workflow you suggest if one fits, then end your reply with this block and nothing after it. The user decides.\n  <<auto>>${GUIDE_HOLD_SHAPE}<</auto>>`,
    `- Deviate: you add, skip or move a step. Write it before your last block.\n  <<auto>>${GUIDE_DEVIATE_SHAPE}<</auto>>`,
  ].join('\n');
};
