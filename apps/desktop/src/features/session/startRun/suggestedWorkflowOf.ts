import type { Workflow } from '@goodboy/types';
import { leadDefaultOf } from './runDefaultSetting';
import { routeWordsOf } from './routeWordsOf';
import type { RunRouteFacts, RunRouteResult } from './runRouteOf';

type Params = {
  readonly facts: RunRouteFacts;
  readonly result: RunRouteResult;
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

type ScoreParams = {
  readonly words: ReadonlyArray<string>;
  readonly workflow: Workflow;
};

const scoreOf = ({ words, workflow }: ScoreParams): number => {
  const named = routeWordsOf({ text: workflow.name }).filter((word) => word.length >= WORD_MIN);
  if (named.length > 0 && named.every((word) => words.includes(word))) {
    return NAME_MATCH_SCORE;
  }
  const detail = new Set(
    routeWordsOf({
      text: [
        workflow.description,
        ...workflow.steps.filter((step) => step.deletedAt == null).map((step) => step.name),
      ].join(' '),
    }).filter((word) => word.length >= DETAIL_WORD_MIN && !GENERIC_WORDS.has(word)),
  );
  const hits = [...detail].filter((word) => words.includes(word)).length;
  return hits >= DETAIL_HITS_MIN ? hits : 0;
};

export const suggestedWorkflowOf = ({ facts, result }: Params): Workflow | null => {
  if (result.preset !== null || result.role !== null) {
    return null;
  }
  if (!leadDefaultOf({ shape: facts.defaultShape }).shouldSuggestWorkflow) {
    return null;
  }
  const words = routeWordsOf({ text: facts.text });
  const scored = facts.presets
    .map((workflow) => ({ workflow, score: scoreOf({ words, workflow }) }))
    .filter((entry) => entry.score > 0);
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  const matches = scored.filter((entry) => entry.score === best).map((entry) => entry.workflow);
  return matches.find((workflow) => workflow.id === facts.lastPresetId) ?? matches[0] ?? null;
};
