import type { RunRoute, Workflow } from '@goodboy/types';
import type { AgentKind } from '../agent-kind';
import { leadRouteOf, presetRouteOf, roleRouteOf } from './routeChoiceOf';
import { routeWordsOf } from './routeWordsOf';
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

const isQuestionOrCheck = ({ text }: TextParams): boolean => {
  const words = routeWordsOf({ text });
  const [first = ''] = words;
  return (
    text.trim().endsWith('?') ||
    QUESTION_STARTS.has(first) ||
    words.some((word) => CHECK_WORDS.has(word))
  );
};

const isSpread = ({ text }: TextParams): boolean => {
  const words = routeWordsOf({ text });
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
  const words = routeWordsOf({ text });
  if (facts.hasTask || isSpread({ text })) {
    return {
      route: leadRouteOf({
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
      route: leadRouteOf({
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
      route: leadRouteOf({
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
    route: leadRouteOf({ row: 6, why: RUN_ROUTE_COPY.why.unsure }),
    ask: text,
    preset: null,
    role: null,
  };
};
