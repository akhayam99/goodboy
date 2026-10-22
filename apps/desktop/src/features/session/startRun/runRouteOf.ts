import type { RunRoute, RunRouteShape, Workflow } from '@goodboy/types';
import type { AgentKind } from '../agent-kind';
import { RUN_ROUTE_COPY } from './runRouteCopy';

type RunDefault = 'auto' | RunRouteShape;

type RunRouteRole = Readonly<{
  kind: AgentKind;
  label: string;
}>;

export type RunRouteFacts = Readonly<{
  text: string;
  presets: ReadonlyArray<Workflow>;
  roles: ReadonlyArray<RunRouteRole>;
  lastPresetId: string | null;
  defaultShape: RunDefault;
  hasTask: boolean;
  mountCount: number;
  pullRequest: Readonly<{ number: number; isFailing: boolean; hasComments: boolean }> | null;
  fileCount: number;
}>;

export type RunRouteResult = Readonly<{
  route: RunRoute;
  ask: string;
  preset: Workflow | null;
  role: AgentKind | null;
}>;

type Params = {
  readonly facts: RunRouteFacts;
};

const WORD_MIN = 4;

const SPREAD_WORDS: ReadonlySet<string> = new Set(['every', 'all', 'each', 'across', 'everywhere']);

const QUESTION_STARTS: ReadonlySet<string> = new Set([
  'which',
  'why',
  'what',
  'how',
  'where',
  'when',
  'who',
  'is',
  'are',
  'does',
  'do',
  'can',
  'should',
]);

const CHECK_WORDS: ReadonlySet<string> = new Set(['check', 'verify', 'audit', 'review', 'find']);

const PULL_REQUEST_WORDS: ReadonlySet<string> = new Set([
  'pr',
  'pull',
  'checks',
  'ci',
  'failing',
  'comments',
  'comment',
  'review',
]);

type TextParams = {
  readonly text: string;
};

const wordsOf = ({ text }: TextParams): ReadonlyArray<string> =>
  text
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .filter((word) => word !== '');

type PickParams = {
  readonly text: string;
  readonly names: ReadonlyArray<string>;
  readonly sign: '~' | '@';
};

type Picked = Readonly<{
  name: string;
  rest: string;
}>;

const pickedOf = ({ text, names, sign }: PickParams): Picked | null => {
  const lower = text.toLowerCase();
  const sorted = [...names].sort((first, second) => second.length - first.length);
  for (const name of sorted) {
    const token = `${sign}${name.toLowerCase()}`;
    const at = lower.indexOf(token);
    if (at === -1) {
      continue;
    }
    const after = lower.charAt(at + token.length);
    if (after !== '' && /[a-z0-9]/.test(after)) {
      continue;
    }
    const rest = `${text.slice(0, at)}${text.slice(at + token.length)}`.replace(/\s+/g, ' ').trim();
    return { name, rest };
  }
  return null;
};

type MatchParams = {
  readonly words: ReadonlyArray<string>;
  readonly preset: Workflow;
};

const isPresetMatch = ({ words, preset }: MatchParams): boolean => {
  const named = wordsOf({ text: preset.name }).filter((word) => word.length >= WORD_MIN);
  if (named.length === 0) {
    return false;
  }
  return named.every((word) => words.includes(word));
};

type CountParams = {
  readonly count: number;
};

const stepsWord = ({ count }: CountParams): string => `${count} ${count === 1 ? 'step' : 'steps'}`;

type PresetRouteParams = {
  readonly preset: Workflow;
  readonly closeness: 'follow' | 'adapt';
  readonly row: number;
  readonly why: string;
};

const presetRouteOf = ({ preset, closeness, row, why }: PresetRouteParams): RunRoute => {
  const steps = preset.steps.filter((step) => step.deletedAt == null).length;
  return {
    shape: 'plan',
    row,
    presetName: preset.name,
    closeness,
    role: null,
    choice: `Plan from ${preset.name}, ${stepsWord({ count: steps })} · ${RUN_ROUTE_COPY.closeness[closeness]}`,
    why,
  };
};

type ShapeRouteParams = {
  readonly shape: RunRouteShape;
  readonly row: number;
  readonly why: string;
};

const shapeRouteOf = ({ shape, row, why }: ShapeRouteParams): RunRoute => ({
  shape,
  row,
  presetName: null,
  closeness: null,
  role: null,
  choice: RUN_ROUTE_COPY.shapes[shape],
  why,
});

const isQuestionOrCheck = ({ text }: TextParams): boolean => {
  const words = wordsOf({ text });
  const [first = ''] = words;
  return (
    text.trim().endsWith('?') ||
    QUESTION_STARTS.has(first) ||
    words.some((word) => CHECK_WORDS.has(word))
  );
};

const isSpread = ({ text }: TextParams): boolean => {
  const words = wordsOf({ text });
  const lines = text.split('\n').filter((line) => /^\s*(?:[-*]|\d+[.)])\s/.test(line));
  return words.some((word) => SPREAD_WORDS.has(word)) || lines.length >= 2;
};

export const runRouteOf = ({ facts }: Params): RunRouteResult => {
  const text = facts.text.trim();
  const named = pickedOf({
    text,
    names: facts.presets.map((preset) => preset.name),
    sign: '~',
  });
  const namedPreset =
    named === null ? null : (facts.presets.find((preset) => preset.name === named.name) ?? null);
  if (named !== null && namedPreset !== null) {
    return {
      route: presetRouteOf({
        preset: namedPreset,
        closeness: 'follow',
        row: 1,
        why: RUN_ROUTE_COPY.why.picked,
      }),
      ask: named.rest,
      preset: namedPreset,
      role: null,
    };
  }
  const role = pickedOf({ text, names: facts.roles.map((entry) => entry.label), sign: '@' });
  const pickedRole =
    role === null ? null : (facts.roles.find((entry) => entry.label === role.name) ?? null);
  if (role !== null && pickedRole !== null) {
    return {
      route: {
        shape: 'lead',
        row: 1,
        presetName: null,
        closeness: null,
        role: pickedRole.kind,
        choice: pickedRole.label,
        why: RUN_ROUTE_COPY.why.picked,
      },
      ask: role.rest,
      preset: null,
      role: pickedRole.kind,
    };
  }
  if (facts.defaultShape !== 'auto') {
    return {
      route: shapeRouteOf({
        shape: facts.defaultShape,
        row: 1,
        why: RUN_ROUTE_COPY.why.yourDefault,
      }),
      ask: text,
      preset: null,
      role: null,
    };
  }
  const words = wordsOf({ text });
  const matches = facts.presets.filter((preset) => isPresetMatch({ words, preset }));
  const matched = matches.find((preset) => preset.id === facts.lastPresetId) ?? matches[0] ?? null;
  if (matched !== null) {
    return {
      route: presetRouteOf({
        preset: matched,
        closeness: 'adapt',
        row: 2,
        why: RUN_ROUTE_COPY.why.matches,
      }),
      ask: text,
      preset: matched,
      role: null,
    };
  }
  if (facts.hasTask || isSpread({ text })) {
    return {
      route: shapeRouteOf({
        shape: 'plan',
        row: 3,
        why:
          facts.mountCount > 1
            ? RUN_ROUTE_COPY.why.acrossProjects({ count: facts.mountCount })
            : RUN_ROUTE_COPY.why.taskWithEnd,
      }),
      ask: text,
      preset: null,
      role: null,
    };
  }
  const pullRequest = facts.pullRequest;
  if (
    pullRequest !== null &&
    (pullRequest.isFailing || pullRequest.hasComments) &&
    (words.some((word) => PULL_REQUEST_WORDS.has(word)) || words.includes(`#${pullRequest.number}`))
  ) {
    return {
      route: shapeRouteOf({
        shape: 'lead',
        row: 4,
        why: RUN_ROUTE_COPY.why.pullRequest({ number: pullRequest.number }),
      }),
      ask: text,
      preset: null,
      role: null,
    };
  }
  if (facts.fileCount === 1 || isQuestionOrCheck({ text })) {
    return {
      route: shapeRouteOf({
        shape: 'lead',
        row: 5,
        why:
          facts.fileCount === 1 ? RUN_ROUTE_COPY.why.oneFile : RUN_ROUTE_COPY.why.questionOrCheck,
      }),
      ask: text,
      preset: null,
      role: null,
    };
  }
  return {
    route: shapeRouteOf({ shape: 'lead', row: 6, why: RUN_ROUTE_COPY.why.unsure }),
    ask: text,
    preset: null,
    role: null,
  };
};
