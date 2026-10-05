import type { ResolveAttempt } from '@goodboy/types';
import type { RemoteView } from './reviewRemote';
import type { ReviewCommentState } from './reviewCommentState';
import { causeOfAttempt, failureSentence } from './failureSentence';

export type ResolveWord = 'open' | 'working' | 'needs_you' | 'ready' | 'couldnt_fix' | 'done';

type ResolveSub =
  | 'waiting'
  | 'pushing'
  | 'stopped'
  | 'push_failed'
  | 'accepted'
  | 'answered'
  | 'skipped'
  | 'pushed'
  | 'resolved_remote';

export const RESOLVE_WORD_LABEL: Readonly<Record<ResolveWord, string>> = {
  open: 'Open',
  working: 'Working',
  needs_you: 'Needs you',
  ready: 'Ready',
  couldnt_fix: "Couldn't fix",
  done: 'Done',
};

export const RESOLVE_LIST_WORDS: ReadonlyArray<ResolveWord> = [
  'needs_you',
  'working',
  'ready',
  'couldnt_fix',
  'open',
  'done',
];

const SUB_LABEL: Readonly<Record<Exclude<ResolveSub, 'resolved_remote'>, string>> = {
  waiting: 'Waiting',
  pushing: 'Pushing',
  stopped: 'Stopped',
  push_failed: 'Push failed',
  accepted: 'Accepted',
  answered: 'Answered',
  skipped: 'Skipped',
  pushed: 'Pushed',
};

export const RESOLVE_WORD_OF_STATE: Readonly<Record<ReviewCommentState, ResolveWord>> = {
  new: 'open',
  drafting: 'working',
  needs: 'needs_you',
  ready: 'ready',
  edited: 'ready',
  outdated: 'ready',
  failed: 'couldnt_fix',
  accepted: 'done',
  replied: 'done',
  skipped: 'done',
  pushed: 'done',
  resolved: 'done',
};

export const resolveLabelOfState = ({ state }: { readonly state: ReviewCommentState }): string =>
  RESOLVE_WORD_LABEL[RESOLVE_WORD_OF_STATE[state]];

const CHECKS_FAILED_LABEL = 'Checks failed';
const COMMENT_CHANGED_LABEL = 'Comment changed';

export type ResolveCommentFacts = {
  readonly state: ReviewCommentState;
  readonly isPublishing: boolean;
  readonly isWaitingForSlot: boolean;
  readonly isPushFailure: boolean;
  readonly sourceLabel: string;
  readonly attempt: Pick<ResolveAttempt, 'failureCause' | 'phase'> | null;
  readonly gitChip: RemoteView | null;
  readonly hasFailedChecks: boolean;
};

export type ResolveCommentProjection = {
  readonly word: ResolveWord;
  readonly sub: ResolveSub | null;
  readonly label: string;
  readonly sentence: string | null;
  readonly gitChip: RemoteView | null;
  readonly hasFailedChecks: boolean;
  readonly isChanged: boolean;
  readonly chips: ReadonlyArray<string>;
};

const subOf = ({ facts }: { readonly facts: ResolveCommentFacts }): ResolveSub | null => {
  const { state } = facts;
  switch (state) {
    case 'new':
    case 'needs':
    case 'ready':
    case 'edited':
    case 'outdated':
      return null;
    case 'drafting':
      return facts.isWaitingForSlot ? 'waiting' : null;
    case 'failed':
      if (facts.isPushFailure) {
        return 'push_failed';
      }
      return causeOfAttempt({ attempt: facts.attempt }) === 'stopped' ? 'stopped' : null;
    case 'accepted':
      return facts.isPublishing ? 'pushing' : 'accepted';
    case 'replied':
      return facts.isPublishing ? 'pushing' : 'answered';
    case 'skipped':
      return 'skipped';
    case 'pushed':
      return 'pushed';
    case 'resolved':
      return 'resolved_remote';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

const labelOf = ({
  word,
  sub,
  sourceLabel,
}: {
  readonly word: ResolveWord;
  readonly sub: ResolveSub | null;
  readonly sourceLabel: string;
}): string => {
  if (sub === null) {
    return RESOLVE_WORD_LABEL[word];
  }
  return sub === 'resolved_remote' ? `Resolved on ${sourceLabel}` : SUB_LABEL[sub];
};

export const projectResolveComment = (facts: ResolveCommentFacts): ResolveCommentProjection => {
  const word = RESOLVE_WORD_OF_STATE[facts.state];
  const sub = subOf({ facts });
  const isChanged = facts.state === 'outdated';
  const sentence =
    word === 'couldnt_fix' && sub !== 'push_failed'
      ? failureSentence({ cause: causeOfAttempt({ attempt: facts.attempt }) })
      : null;
  const hasFailedChecks = facts.hasFailedChecks && word === 'ready';
  return {
    word,
    sub,
    label: labelOf({ word, sub, sourceLabel: facts.sourceLabel }),
    sentence,
    gitChip: facts.gitChip,
    hasFailedChecks,
    isChanged,
    chips: [
      ...(isChanged ? [COMMENT_CHANGED_LABEL] : []),
      ...(facts.gitChip === null ? [] : [facts.gitChip.word]),
      ...(hasFailedChecks ? [CHECKS_FAILED_LABEL] : []),
    ],
  };
};

export type ResolveTally = Readonly<Record<ResolveWord, number>>;

const emptyResolveTally = (): Record<ResolveWord, number> => ({
  open: 0,
  working: 0,
  needs_you: 0,
  ready: 0,
  couldnt_fix: 0,
  done: 0,
});

export const resolveTallyOf = ({
  states,
}: {
  readonly states: ReadonlyArray<ReviewCommentState>;
}): ResolveTally => {
  const tally = emptyResolveTally();
  for (const state of states) {
    tally[RESOLVE_WORD_OF_STATE[state]] += 1;
  }
  return tally;
};

const TALLY_PHRASE: ReadonlyArray<readonly [Exclude<ResolveWord, 'done' | 'open'>, string]> = [
  ['ready', 'ready'],
  ['needs_you', 'needs you'],
  ['working', 'working'],
  ['couldnt_fix', "couldn't fix"],
];

export const resolveTallyParts = ({
  tally,
}: {
  readonly tally: ResolveTally;
}): ReadonlyArray<string> =>
  TALLY_PHRASE.flatMap(([word, phrase]) => (tally[word] === 0 ? [] : [`${tally[word]} ${phrase}`]));
