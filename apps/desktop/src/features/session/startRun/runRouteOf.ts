import type { RunRoute, Workflow } from '@goodboy/types';
import type { AgentKind } from '../agent-kind';
import { presetRouteOf, roleRouteOf, shapeRouteOf } from './routeChoiceOf';
import type { RunDefault } from './runDefaultSetting';
import { RUN_ROUTE_COPY } from './runRouteCopy';

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

const DETAIL_WORD_MIN = 5;

const DETAIL_HITS_MIN = 2;

const NAME_MATCH_SCORE = 100;

const GENERIC_WORDS: ReadonlySet<string> = new Set([
  'about',
  'after',
  'agent',
  'before',
  'change',
  'changes',
  'every',
  'files',
  'first',
  'other',
  'pages',
  'their',
  'there',
  'these',
  'thing',
  'things',
  'where',
  'which',
  'while',
  'write',
]);

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

const presetScoreOf = ({ words, preset }: MatchParams): number => {
  const named = wordsOf({ text: preset.name }).filter((word) => word.length >= WORD_MIN);
  if (named.length > 0 && named.every((word) => words.includes(word))) {
    return NAME_MATCH_SCORE;
  }
  const detail = new Set(
    wordsOf({
      text: [
        preset.description,
        ...preset.steps.filter((step) => step.deletedAt == null).map((step) => step.name),
      ].join(' '),
    }).filter((word) => word.length >= DETAIL_WORD_MIN && !GENERIC_WORDS.has(word)),
  );
  const hits = [...detail].filter((word) => words.includes(word)).length;
  return hits >= DETAIL_HITS_MIN ? hits : 0;
};

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
      route: roleRouteOf({
        role: pickedRole.kind,
        label: pickedRole.label,
        row: 1,
        why: RUN_ROUTE_COPY.why.picked,
      }),
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
  const scored = facts.presets
    .map((preset) => ({ preset, score: presetScoreOf({ words, preset }) }))
    .filter((entry) => entry.score > 0);
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  const matches = scored.filter((entry) => entry.score === best).map((entry) => entry.preset);
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
