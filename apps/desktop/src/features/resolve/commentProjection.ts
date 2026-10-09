import type { Tone } from '@goodboy/ui';
import type { ResolveAttempt } from '@goodboy/types';
import type { RemoteView } from './reviewRemote';
import type { ReviewCommentState } from './reviewCommentState';
import { causeOfAttempt, failureSentence } from './failureSentence';

export type ResolveWord =
  | 'open'
  | 'working'
  | 'question'
  | 'to_review'
  | 'push_failed'
  | 'couldnt_fix'
  | 'ready'
  | 'done'
  | 'left_open';

export type ResolveGroup =
  'needs_you' | 'working' | 'ready_to_push' | 'open' | 'done' | 'left_open';

type ResolveSub = 'waiting' | 'pushing' | 'stopped' | 'resolved_remote';

export const RESOLVE_WORD_LABEL: Readonly<Record<ResolveWord, string>> = {
  open: 'Open',
  working: 'Working',
  question: 'Question',
  to_review: 'To review',
  push_failed: 'Push failed',
  couldnt_fix: "Couldn't fix",
  ready: 'Ready',
  done: 'Done',
  left_open: 'Left open',
};

export const RESOLVE_WORD_TONE: Readonly<Record<ResolveWord, Tone>> = {
  open: 'neutral',
  working: 'info',
  question: 'warning',
  to_review: 'warning',
  push_failed: 'danger',
  couldnt_fix: 'warning',
  ready: 'success',
  done: 'neutral',
  left_open: 'neutral',
};

export const RESOLVE_GROUP_LABEL: Readonly<Record<Exclude<ResolveGroup, 'left_open'>, string>> = {
  needs_you: 'Needs you',
  working: 'Working',
  ready_to_push: 'Ready to push',
  open: 'Open',
  done: 'Done',
};

export const leftOpenGroupLabel = ({ sourceLabel }: { readonly sourceLabel: string }): string =>
  `Left open on ${sourceLabel}`;

export const RESOLVE_LIST_GROUPS: ReadonlyArray<ResolveGroup> = [
  'needs_you',
  'working',
  'ready_to_push',
  'open',
  'done',
  'left_open',
];

export const RESOLVE_GROUP_OF_WORD: Readonly<Record<ResolveWord, ResolveGroup>> = {
  open: 'open',
  working: 'working',
  question: 'needs_you',
  to_review: 'needs_you',
  push_failed: 'needs_you',
  couldnt_fix: 'needs_you',
  ready: 'ready_to_push',
  done: 'done',
  left_open: 'left_open',
};

export const RESOLVE_WORD_RANK: Readonly<Record<ResolveWord, number>> = {
  question: 0,
  push_failed: 1,
  to_review: 2,
  couldnt_fix: 3,
  working: 4,
  ready: 5,
  open: 6,
  done: 7,
  left_open: 8,
};

const SUB_LABEL: Readonly<Record<Exclude<ResolveSub, 'resolved_remote'>, string>> = {
  waiting: 'Waiting',
  pushing: 'Pushing',
  stopped: 'Stopped',
};

const RESOLVE_WORD_OF_STATE: Readonly<Record<ReviewCommentState, ResolveWord>> = {
  new: 'open',
  drafting: 'working',
  needs: 'question',
  ready: 'to_review',
  edited: 'to_review',
  outdated: 'to_review',
  failed: 'couldnt_fix',
  accepted: 'ready',
  replied: 'ready',
  skipped: 'left_open',
  pushed: 'done',
  resolved: 'done',
};

export const resolveWordOfState = ({
  state,
  isPushFailure = false,
}: {
  readonly state: ReviewCommentState;
  readonly isPushFailure?: boolean;
}): ResolveWord =>
  state === 'failed' && isPushFailure ? 'push_failed' : RESOLVE_WORD_OF_STATE[state];

export const resolveLabelOfState = ({
  state,
  isPushFailure = false,
}: {
  readonly state: ReviewCommentState;
  readonly isPushFailure?: boolean;
}): string => RESOLVE_WORD_LABEL[resolveWordOfState({ state, isPushFailure })];

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
        return null;
      }
      return causeOfAttempt({ attempt: facts.attempt }) === 'stopped' ? 'stopped' : null;
    case 'accepted':
    case 'replied':
      return facts.isPublishing ? 'pushing' : null;
    case 'skipped':
    case 'pushed':
      return null;
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
  const word = resolveWordOfState({ state: facts.state, isPushFailure: facts.isPushFailure });
  const sub = subOf({ facts });
  const isChanged = facts.state === 'outdated';
  const sentence =
    word === 'couldnt_fix'
      ? failureSentence({ cause: causeOfAttempt({ attempt: facts.attempt }) })
      : null;
  const hasFailedChecks = facts.hasFailedChecks && (word === 'to_review' || word === 'ready');
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
