import { RESOLVE_WORD_LABEL, type ResolveWord } from '../../resolve/commentProjection';
import { pluralize } from '../../../shared/utils/pluralize';

export type AskRightNowTone = 'running' | 'needs' | 'failed' | 'done' | 'idle' | 'cost';

export type AskRightNowLine = {
  readonly key: string;
  readonly tone: AskRightNowTone;
  readonly lead: string;
  readonly detail: string | null;
};

export type AskRightNowInput = {
  readonly description: string;
  readonly commentWords: ReadonlyArray<ResolveWord>;
  readonly prNumber: number | null;
  readonly runningAgents: ReadonlyArray<{ readonly name: string; readonly minutes: number | null }>;
  readonly failedAgents: ReadonlyArray<string>;
  readonly openQuestionsFrom: ReadonlyArray<string | null>;
  readonly cost: number;
};

const COUNTED_WORDS: ReadonlyArray<ResolveWord> = ['ready', 'needs_you', 'working', 'couldnt_fix'];

const MAX_RUNNING_LINES = 3;

const commentLine = ({
  commentWords,
  prNumber,
}: Pick<AskRightNowInput, 'commentWords' | 'prNumber'>): AskRightNowLine | null => {
  const live = commentWords.filter((word) => word !== 'done');
  if (live.length === 0) {
    return null;
  }
  const isFixing = live.includes('working');
  const on = prNumber === null ? '' : ` on #${prNumber}`;
  const noun = pluralize(live.length, 'comment');
  const counts = COUNTED_WORDS.flatMap((word) => {
    const count = live.filter((candidate) => candidate === word).length;
    return count === 0 && word !== 'needs_you'
      ? []
      : [`${count} ${RESOLVE_WORD_LABEL[word].toLowerCase()}`];
  });
  return {
    key: 'comments',
    tone: isFixing ? 'running' : live.includes('needs_you') ? 'needs' : 'idle',
    lead: isFixing ? `Fixing ${noun}${on}` : `${noun}${on}`,
    detail: counts.join(' · '),
  };
};

const questionLine = ({
  openQuestionsFrom,
}: Pick<AskRightNowInput, 'openQuestionsFrom'>): AskRightNowLine | null => {
  if (openQuestionsFrom.length === 0) {
    return null;
  }
  const names = [...new Set(openQuestionsFrom.filter((name): name is string => name !== null))];
  const from = names.length === 0 ? '' : ` from ${names.join(', ')}`;
  return {
    key: 'questions',
    tone: 'needs',
    lead: `${pluralize(openQuestionsFrom.length, 'open question')}${from}`,
    detail: null,
  };
};

export const formatAskCost = (cost: number): string => `$${cost.toFixed(2)}`;

export const askRightNow = (input: AskRightNowInput): ReadonlyArray<AskRightNowLine> => {
  const running = input.runningAgents
    .slice(0, MAX_RUNNING_LINES)
    .map((agent, index): AskRightNowLine => ({
      key: `running-${index}`,
      tone: 'running',
      lead: `${agent.name} is running`,
      detail: agent.minutes === null ? null : `${agent.minutes} min`,
    }));
  const failed = input.failedAgents.slice(0, 1).map((name): AskRightNowLine => ({
    key: 'failed',
    tone: 'failed',
    lead: `${name} failed`,
    detail: null,
  }));
  const stateLines = [commentLine(input), ...running, questionLine(input), ...failed].filter(
    (line): line is AskRightNowLine => line !== null,
  );
  const lead: ReadonlyArray<AskRightNowLine> =
    stateLines.length === 0 && input.description.trim() !== ''
      ? [{ key: 'state', tone: 'idle', lead: input.description, detail: null }]
      : stateLines;
  return [
    ...lead,
    {
      key: 'cost',
      tone: 'cost',
      lead: `${formatAskCost(input.cost)} in this session`,
      detail: null,
    },
  ];
};

export const askRightNowText = (lines: ReadonlyArray<AskRightNowLine>): ReadonlyArray<string> =>
  lines.map((line) => (line.detail === null ? line.lead : `${line.lead} · ${line.detail}`));

type SuggestionParams = Pick<
  AskRightNowInput,
  'commentWords' | 'failedAgents' | 'openQuestionsFrom' | 'prNumber'
>;

export const askSuggestions = ({
  commentWords,
  failedAgents,
  openQuestionsFrom,
  prNumber,
}: SuggestionParams): ReadonlyArray<string> => {
  const needsYou = openQuestionsFrom.length > 0 || commentWords.includes('needs_you');
  const failed = failedAgents[0];
  const candidates = [
    needsYou ? 'What needs me?' : null,
    failed === undefined ? null : `Why did ${failed} fail?`,
    commentWords.includes('couldnt_fix') ? 'Why couldn’t the fix run fix a comment?' : null,
    'What changed since I last looked?',
    'What is happening right now?',
    prNumber === null ? null : `Is #${prNumber} ready to merge?`,
    'What is left to do?',
  ].filter((candidate): candidate is string => candidate !== null);
  return candidates.slice(0, 3);
};
