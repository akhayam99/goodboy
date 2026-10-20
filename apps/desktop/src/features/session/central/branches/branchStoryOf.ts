import type { StageTrackState, Tone } from '@goodboy/ui';
import type { BranchFacts, BranchRequestFacts } from './branchFactsOf';
import { BRANCH_STATE_TONE, type BranchState } from './branchStateTone';

type BranchStepId = 'commits' | 'pushed' | 'pr' | 'checks' | 'review' | 'merged';

export type BranchStep = Readonly<{
  id: BranchStepId;
  label: string;
  name: string;
  state: StageTrackState;
}>;

type BranchRank = 0 | 1 | 2 | 3 | 4 | 5;

type BranchStory = Readonly<{
  steps: ReadonlyArray<BranchStep>;
  state: BranchState;
  word: string;
  tone: Tone;
  blocker: string;
  rank: BranchRank;
}>;

export type BranchDetailWords = Readonly<{
  failingChecks: ReadonlyArray<string>;
  openThreads: number;
}>;

type StepSpec = Readonly<{ id: BranchStepId; label: string }>;

const STEPS: ReadonlyArray<StepSpec> = [
  { id: 'commits', label: 'Commit' },
  { id: 'pushed', label: 'Push' },
  { id: 'pr', label: 'Pull request' },
  { id: 'checks', label: 'Checks' },
  { id: 'review', label: 'Review' },
  { id: 'merged', label: 'Merge' },
];

type Standing = Readonly<{
  at: number;
  branchState: BranchState;
  word: string;
  blocker: string;
  rank: BranchRank;
}>;

type FactParams = {
  readonly fact: BranchFacts;
};

type DetailParams = FactParams & {
  readonly detail: BranchDetailWords | null;
};

type PluralParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const skipsOf = ({ fact }: FactParams): ReadonlyArray<BranchStepId> => {
  const request = fact.request;
  if (request === null || fact.isStale || request.state === 'closed') {
    return [];
  }
  const skips: Array<BranchStepId> = [];
  if (request.checks === null && request.isChecksAbsent) {
    skips.push('checks');
  }
  if (request.reviewDecision === null && request.isReviewOptional) {
    skips.push('review');
  }
  return skips;
};

const plural = ({ count, one, many }: PluralParams): string =>
  `${count} ${count === 1 ? one : many}`;

const behindPhraseOf = ({ fact }: FactParams): string | null =>
  fact.behind !== null && fact.behind > 0 ? `${fact.behind} behind ${fact.baseBranch}` : null;

type OnlyDetailParams = {
  readonly detail: BranchDetailWords | null;
};

const failingBlockerOf = ({ detail }: OnlyDetailParams): string => {
  if (detail === null || detail.failingChecks.length === 0) {
    return 'Failed on the last push';
  }
  return `${detail.failingChecks.join(', ')} failed`;
};

const changesBlockerOf = ({ detail }: OnlyDetailParams): string => {
  if (detail === null || detail.openThreads === 0) {
    return 'A reviewer asked for changes';
  }
  return `${plural({ count: detail.openThreads, one: 'thread', many: 'threads' })} to answer`;
};

type ReadyParams = {
  readonly request: BranchRequestFacts;
  readonly isChecksSkipped: boolean;
  readonly isReviewSkipped: boolean;
};

const readyBlockerOf = ({ request, isChecksSkipped, isReviewSkipped }: ReadyParams): string => {
  if (isChecksSkipped && isReviewSkipped) {
    return 'No checks or review required';
  }
  if (request.reviewDecision === 'approved') {
    return isChecksSkipped ? 'No checks on this repo' : 'Ready to merge';
  }
  return isReviewSkipped ? 'No review required' : 'Every check passed';
};

const requestStandingOf = ({ fact, detail }: DetailParams): Standing => {
  const request = fact.request;
  if (request === null) {
    return { at: 0, branchState: 'unread', word: 'Branch', blocker: '', rank: 4 };
  }
  if (request.state === 'merged') {
    return {
      at: 5,
      branchState: 'merged',
      word: 'Merged',
      blocker: `Into ${fact.baseBranch}`,
      rank: 5,
    };
  }
  if (request.state === 'closed') {
    return {
      at: 2,
      branchState: 'closed',
      word: 'Closed',
      blocker: 'Not merged',
      rank: 5,
    };
  }
  if (fact.isStale) {
    return {
      at: 3,
      branchState: request.isDraft ? 'draft' : 'open',
      word: request.isDraft ? 'Draft' : 'Open',
      blocker: fact.checkedAgo === null ? 'Not checked lately' : `Checked ${fact.checkedAgo}`,
      rank: 3,
    };
  }
  if (request.state === 'queued') {
    return {
      at: 5,
      branchState: 'queued',
      word: 'In merge queue',
      blocker: `Merging into ${fact.baseBranch}`,
      rank: 3,
    };
  }
  if (request.checks === 'failure') {
    return {
      at: 3,
      branchState: 'checks-failing',
      word: 'Checks failing',
      blocker: failingBlockerOf({ detail }),
      rank: 0,
    };
  }
  if (request.checks === 'pending') {
    return {
      at: 3,
      branchState: 'checks-running',
      word: 'Checks running',
      blocker: request.isDraft ? 'Then mark it ready' : 'Review comes next',
      rank: 3,
    };
  }
  if (request.reviewDecision === 'changes_requested') {
    return {
      at: 4,
      branchState: 'changes-requested',
      word: 'Changes requested',
      blocker: changesBlockerOf({ detail }),
      rank: 0,
    };
  }
  if (request.isDraft) {
    return {
      at: 2,
      branchState: 'draft',
      word: 'Draft',
      blocker: request.checks === 'success' ? 'Checks passed' : 'Not ready for review',
      rank: 3,
    };
  }
  if (request.reviewDecision === 'review_required') {
    return {
      at: 4,
      branchState: 'in-review',
      word: 'In review',
      blocker: 'Waiting for a reviewer',
      rank: 3,
    };
  }
  if (request.isMergeable === false) {
    const behind = behindPhraseOf({ fact });
    return {
      at: 4,
      branchState: 'conflicts',
      word: 'Conflicts',
      blocker: behind ?? 'Needs a rebase',
      rank: 1,
    };
  }
  const skips = skipsOf({ fact });
  const isChecksSkipped = skips.includes('checks');
  const isReviewSkipped = skips.includes('review');
  const isApproved = request.reviewDecision === 'approved';
  if (
    request.checks === 'success' ||
    request.reviewDecision === 'approved' ||
    (isChecksSkipped && isReviewSkipped)
  ) {
    return {
      at: 5,
      branchState: isApproved ? 'approved' : 'ready',
      word: isApproved ? 'Approved' : 'Ready to merge',
      blocker: readyBlockerOf({ request, isChecksSkipped, isReviewSkipped }),
      rank: 1,
    };
  }
  return {
    at: 2,
    branchState: 'open',
    word: 'Open',
    blocker: isChecksSkipped ? 'No checks on this repo' : 'No check results yet',
    rank: 3,
  };
};

const localStandingOf = ({ fact }: FactParams): Standing => {
  const status = fact.status;
  if (status === null) {
    return { at: 0, branchState: 'unread', word: 'Branch', blocker: '', rank: 4 };
  }
  const ahead = status.ahead ?? 0;
  const push = status.push;
  if (status.isRebasing) {
    return {
      at: 0,
      branchState: 'rebasing',
      word: 'Rebasing',
      blocker: `Onto ${fact.baseBranch}`,
      rank: 3,
    };
  }
  if (push.kind === 'gone') {
    return {
      at: 1,
      branchState: 'gone',
      word: 'Branch gone',
      blocker: 'Remote branch deleted',
      rank: 4,
    };
  }
  if (ahead === 0 && (push.kind === 'not-pushed' || push.kind === 'unknown')) {
    const changed = status.changedFiles ?? 0;
    return {
      at: 0,
      branchState: 'nothing-committed',
      word: 'Nothing committed',
      blocker:
        changed > 0
          ? plural({ count: changed, one: 'file changed', many: 'files changed' })
          : 'No commits yet',
      rank: 4,
    };
  }
  if (push.kind === 'not-pushed') {
    return {
      at: 1,
      branchState: 'not-pushed',
      word: 'Not pushed',
      blocker: `${plural({ count: ahead, one: 'commit', many: 'commits' })} to push`,
      rank: 4,
    };
  }
  if (push.kind === 'ahead' || push.kind === 'diverged') {
    return {
      at: 1,
      branchState: 'not-pushed',
      word: 'Not pushed',
      blocker: `${plural({ count: push.ahead, one: 'commit', many: 'commits' })} to push`,
      rank: 4,
    };
  }
  return {
    at: 2,
    branchState: 'no-request',
    word: 'No pull request',
    blocker: `${plural({ count: ahead, one: 'commit', many: 'commits' })} pushed`,
    rank: 4,
  };
};

type StoryParams = FactParams & {
  readonly hasCard: boolean;
  readonly detail: BranchDetailWords | null;
};

type StandingParams = {
  readonly standing: Standing;
};

type StepsParams = StandingParams & {
  readonly skips: ReadonlyArray<BranchStepId>;
};

const stepsOf = ({ standing, skips }: StepsParams): ReadonlyArray<BranchStep> =>
  STEPS.map((spec, index) => {
    if (index === standing.at) {
      return { ...spec, name: spec.label, state: 'current' };
    }
    if (skips.includes(spec.id)) {
      return { ...spec, name: `${spec.label} skipped`, state: 'skipped' };
    }
    return { ...spec, name: spec.label, state: index < standing.at ? 'done' : 'todo' };
  });

type JoinParams = {
  readonly parts: ReadonlyArray<string | null>;
};

const joinedOf = ({ parts }: JoinParams): string =>
  parts.filter((part): part is string => part !== null && part !== '').join(', ');

const branchStoryOf = ({ fact, hasCard, detail }: StoryParams): BranchStory => {
  const standing =
    fact.request === null ? localStandingOf({ fact }) : requestStandingOf({ fact, detail });
  const isOver = fact.request?.state === 'merged' || fact.request?.state === 'closed';
  const isLive = fact.liveCount > 0 && !isOver;
  const liveWords =
    fact.liveCount > 1
      ? `${fact.liveCount} agents are working`
      : `${fact.liveTitle ?? 'An agent'} is working`;
  const staleNote = fact.isStale && fact.checkedAgo !== null ? `checked ${fact.checkedAgo}` : null;
  const blocker = isLive ? joinedOf({ parts: [liveWords, staleNote] }) : standing.blocker;
  let rank = standing.rank;
  if (rank > 1 && hasCard && !isOver) {
    rank = 1;
  }
  if (rank > 2 && isLive) {
    rank = 2;
  }
  return {
    steps: stepsOf({ standing, skips: skipsOf({ fact }) }),
    state: standing.branchState,
    word: standing.word,
    tone: BRANCH_STATE_TONE[standing.branchState],
    blocker,
    rank,
  };
};

type SentenceParams = {
  readonly fact: BranchFacts;
  readonly story: BranchStory;
};

export const branchSentenceOf = ({ fact, story }: SentenceParams): string => {
  const request = fact.request === null ? '' : `, ${fact.request.noun}${fact.request.number}`;
  const skipped = story.steps.filter((step) => step.state === 'skipped');
  const skippedWords =
    skipped.length === 0 ? '' : ` ${skipped.map((step) => step.name).join(', ')}.`;
  const reason = story.blocker === '' ? '' : `, ${story.blocker}`;
  return `${fact.branch}, ${fact.projectName}${request}: ${story.word}${reason}.${skippedWords}`;
};

export type BranchEntry = Readonly<{
  fact: BranchFacts;
  story: BranchStory;
}>;

type EntriesParams = {
  readonly facts: ReadonlyArray<BranchFacts>;
  readonly cardOrderByMountId: ReadonlyMap<string, number>;
  readonly detailByMountId: ReadonlyMap<string, BranchDetailWords>;
};

type OrderParams = {
  readonly entry: BranchEntry;
};

export const branchEntriesOf = ({
  facts,
  cardOrderByMountId,
  detailByMountId,
}: EntriesParams): ReadonlyArray<BranchEntry> => {
  const entries = facts.map((fact) => ({
    fact,
    story: branchStoryOf({
      fact,
      hasCard: cardOrderByMountId.has(fact.mountId),
      detail: detailByMountId.get(fact.mountId) ?? null,
    }),
  }));
  const orderOf = ({ entry }: OrderParams): number =>
    cardOrderByMountId.get(entry.fact.mountId) ?? Number.MAX_SAFE_INTEGER;
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (first, second) =>
        first.entry.story.rank - second.entry.story.rank ||
        orderOf({ entry: first.entry }) - orderOf({ entry: second.entry }) ||
        first.index - second.index,
    )
    .map(({ entry }) => entry);
};

const BRANCH_ROW_CAP = 8;

type FoldParams = {
  readonly entries: ReadonlyArray<BranchEntry>;
};

export type BranchFold = Readonly<{
  shown: ReadonlyArray<BranchEntry>;
  hidden: ReadonlyArray<BranchEntry>;
  label: string | null;
}>;

export const branchFoldOf = ({ entries }: FoldParams): BranchFold => {
  const isOneOver = entries.length === BRANCH_ROW_CAP + 1;
  const shown = isOneOver ? entries : entries.slice(0, BRANCH_ROW_CAP);
  const hidden = isOneOver ? [] : entries.slice(BRANCH_ROW_CAP);
  if (hidden.length === 0) {
    return { shown, hidden, label: null };
  }
  const merged = hidden.filter((entry) => entry.fact.request?.state === 'merged').length;
  const base = plural({ count: hidden.length, one: 'more branch', many: 'more branches' });
  return { shown, hidden, label: merged === 0 ? base : `${base}, ${merged} merged` };
};
