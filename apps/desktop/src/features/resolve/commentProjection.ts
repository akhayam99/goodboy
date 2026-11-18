import type { ResolveAttempt, ResolveFailureCause } from '@goodboy/types';
import { NAMES } from '../../shared/utils/names';
import type { RemoteView } from './reviewRemote';
import type { ReviewCommentState } from './reviewCommentState';
import { causeOfThread, failureSentence } from './failureSentence';

export type ResolveWord =
  | 'open'
  | 'working'
  | 'question'
  | 'to_review'
  | 'push_failed'
  | 'couldnt_fix'
  | 'ready'
  | 'replied'
  | 'done'
  | 'left_open'
  | 'in_run'
  | 'run_finished';

export type ResolveGroup = 'needs_you' | 'working' | 'done' | 'left_open';

type ResolveSub = 'waiting' | 'pushing' | 'stopped' | 'needs_run' | 'resolved_remote';

export const RESOLVE_WORD_LABEL: Readonly<Record<ResolveWord, string>> = {
  open: 'Open',
  working: 'Fixing',
  question: 'Question',
  to_review: NAMES.fixReady,
  push_failed: 'Push failed',
  couldnt_fix: 'Failed',
  ready: 'Fixed',
  replied: 'Replied',
  done: 'Done',
  left_open: 'Left open',
  in_run: 'In a run',
  run_finished: 'Run finished',
};

export const RESOLVE_VOCAB = {
  applyFix: NAMES.applyFix,
  applied: 'Applied',
  replied: 'Replied',
  wontFix: "Won't fix",
} as const;

type CountParams = {
  readonly count: number;
};

export const applyFixesLabel = ({ count }: CountParams): string =>
  count === 1 ? RESOLVE_VOCAB.applyFix : `Apply ${count} fixes`;

export const RESOLVE_GROUP_LABEL: Readonly<Record<Exclude<ResolveGroup, 'left_open'>, string>> = {
  needs_you: 'Needs you',
  working: 'Working',
  done: 'Done',
};

export const leftOpenGroupLabel = ({ sourceLabel }: { readonly sourceLabel: string }): string =>
  `Left open on ${sourceLabel}`;

export const RESOLVE_LIST_GROUPS: ReadonlyArray<ResolveGroup> = [
  'needs_you',
  'working',
  'done',
  'left_open',
];

export const RESOLVE_GROUP_OF_WORD: Readonly<Record<ResolveWord, ResolveGroup>> = {
  open: 'needs_you',
  working: 'working',
  question: 'needs_you',
  to_review: 'needs_you',
  push_failed: 'needs_you',
  couldnt_fix: 'needs_you',
  ready: 'done',
  replied: 'done',
  done: 'done',
  left_open: 'left_open',
  in_run: 'working',
  run_finished: 'needs_you',
};

export const RESOLVE_WORD_RANK: Readonly<Record<ResolveWord, number>> = {
  question: 0,
  push_failed: 1,
  to_review: 2,
  run_finished: 3,
  couldnt_fix: 4,
  working: 5,
  in_run: 6,
  ready: 7,
  open: 8,
  replied: 9,
  done: 10,
  left_open: 11,
};

const SUB_LABEL: Readonly<Record<Exclude<ResolveSub, 'resolved_remote'>, string>> = {
  waiting: 'Waiting',
  pushing: 'Pushing',
  stopped: 'Stopped',
  needs_run: 'Needs a run',
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
  pushed: 'replied',
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

export type ResolveCommentRun = {
  readonly stateWord: string;
  readonly end: 'working' | 'finished' | 'stopped';
};

const RUN_TAKES: ReadonlySet<ResolveWord> = new Set<ResolveWord>([
  'open',
  'couldnt_fix',
  'left_open',
]);
const FINISHED_RUN_TAKES: ReadonlySet<ResolveWord> = new Set<ResolveWord>(['open', 'couldnt_fix']);
const COMMENT_CHANGED_LABEL = 'Comment changed';
const RUN_CHANGED_WORD = 'Changed';

export type ResolveCommentFacts = {
  readonly state: ReviewCommentState;
  readonly isPublishing: boolean;
  readonly isWaitingForSlot: boolean;
  readonly isPushFailure: boolean;
  readonly sourceLabel: string;
  readonly attempt: Pick<ResolveAttempt, 'failureCause' | 'phase'> | null;
  readonly stateReason: string | null;
  readonly gitChip: RemoteView | null;
  readonly hasFailedChecks: boolean;
  readonly run?: ResolveCommentRun | null;
  readonly isSourceChanged?: boolean;
};

type FactsParams = {
  readonly facts: ResolveCommentFacts;
};

const causeOfFacts = ({ facts }: FactsParams): ResolveFailureCause | null =>
  causeOfThread({ thread: { stateReason: facts.stateReason }, attempt: facts.attempt });

const FAILED_SUB: Partial<Record<ResolveFailureCause, ResolveSub>> = {
  stopped: 'stopped',
  needs_a_run: 'needs_run',
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
    case 'failed': {
      if (facts.isPushFailure) {
        return null;
      }
      const cause = causeOfFacts({ facts });
      return cause === null ? null : (FAILED_SUB[cause] ?? null);
    }
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

type RunWordParams = {
  readonly word: ResolveWord;
  readonly run: ResolveCommentRun | null;
};

const runWordOf = ({ word, run }: RunWordParams): ResolveWord => {
  if (run === null) {
    return word;
  }
  switch (run.end) {
    case 'working':
      return RUN_TAKES.has(word) ? 'in_run' : word;
    case 'finished':
      return FINISHED_RUN_TAKES.has(word) ? 'run_finished' : word;
    case 'stopped':
      return word;
    default: {
      const exhaustive: never = run.end;
      return exhaustive;
    }
  }
};

export const projectResolveComment = (facts: ResolveCommentFacts): ResolveCommentProjection => {
  const run = facts.run ?? null;
  const ownWord = resolveWordOfState({ state: facts.state, isPushFailure: facts.isPushFailure });
  const word = runWordOf({ word: ownWord, run });
  const sub = word === ownWord ? subOf({ facts }) : null;
  const isChanged = facts.state === 'outdated';
  const sentence =
    word === 'couldnt_fix' ? failureSentence({ cause: causeOfFacts({ facts }) }) : null;
  const hasFailedChecks = facts.hasFailedChecks && (word === 'to_review' || word === 'ready');
  return {
    word,
    sub,
    label:
      word === 'in_run' && run !== null
        ? `${RESOLVE_WORD_LABEL.in_run} · ${facts.isSourceChanged === true ? RUN_CHANGED_WORD : run.stateWord}`
        : labelOf({ word, sub, sourceLabel: facts.sourceLabel }),
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
