import type { BranchFacts, BranchRequestFacts } from './branchFactsOf';

type BranchStepId = 'branch' | 'commits' | 'pushed' | 'pr' | 'checks' | 'review' | 'merged';

export type BranchStepState = 'done' | 'current' | 'ring' | 'todo' | 'skipped';

export type BranchTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

export type BranchStep = Readonly<{
  id: BranchStepId;
  label: string;
  name: string;
  state: BranchStepState;
}>;

type BranchRank = 0 | 1 | 2 | 3 | 4 | 5;

type BranchStory = Readonly<{
  steps: ReadonlyArray<BranchStep>;
  word: string;
  tone: BranchTone;
  blocker: string;
  rank: BranchRank;
}>;

export type BranchDetailWords = Readonly<{
  failingChecks: ReadonlyArray<string>;
  openThreads: number;
}>;

type StepSpec = Readonly<{ id: BranchStepId; label: string }>;

const STEPS: ReadonlyArray<StepSpec> = [
  { id: 'branch', label: 'Branch' },
  { id: 'commits', label: 'Commits' },
  { id: 'pushed', label: 'Pushed' },
  { id: 'pr', label: 'Pull request' },
  { id: 'checks', label: 'Checks' },
  { id: 'review', label: 'Review' },
  { id: 'merged', label: 'Merged' },
];

type Standing = Readonly<{
  at: number;
  state: 'current' | 'ring';
  word: string;
  tone: BranchTone;
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
    return 'Checks failed on the last push';
  }
  return `${detail.failingChecks.join(', ')} failed on the last push`;
};

const changesBlockerOf = ({ detail }: OnlyDetailParams): string => {
  if (detail === null || detail.openThreads === 0) {
    return 'A reviewer asked for changes';
  }
  return `${plural({ count: detail.openThreads, one: 'open conversation', many: 'open conversations' })} to resolve`;
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
    return isChecksSkipped ? 'Approved, no checks on this repo' : 'Approved, every check passed';
  }
  return isReviewSkipped ? 'Every check passed, no review required' : 'Every check passed';
};

const requestStandingOf = ({ fact, detail }: DetailParams): Standing => {
  const request = fact.request;
  if (request === null) {
    return { at: 0, state: 'current', word: 'Branch', tone: 'neutral', blocker: '', rank: 4 };
  }
  if (request.state === 'merged') {
    return {
      at: 6,
      state: 'current',
      word: 'Merged',
      tone: 'success',
      blocker: `Merged into ${fact.baseBranch}`,
      rank: 5,
    };
  }
  if (request.state === 'closed') {
    return {
      at: 3,
      state: 'current',
      word: 'Closed',
      tone: 'neutral',
      blocker: 'Closed without merging',
      rank: 5,
    };
  }
  if (fact.isStale) {
    return {
      at: 4,
      state: 'ring',
      word: request.isDraft ? 'Draft' : 'Open',
      tone: 'neutral',
      blocker: fact.checkedAgo === null ? 'Not checked lately' : `Checked ${fact.checkedAgo}`,
      rank: 3,
    };
  }
  if (request.state === 'queued') {
    return {
      at: 6,
      state: 'current',
      word: 'Queued',
      tone: 'info',
      blocker: `In the merge queue for ${fact.baseBranch}`,
      rank: 3,
    };
  }
  if (request.checks === 'failure') {
    return {
      at: 4,
      state: 'current',
      word: 'Checks failing',
      tone: 'danger',
      blocker: failingBlockerOf({ detail }),
      rank: 0,
    };
  }
  if (request.checks === 'pending') {
    return {
      at: 4,
      state: 'ring',
      word: 'Checks running',
      tone: 'info',
      blocker: request.isDraft ? 'Then mark it ready for review' : 'Then a review from the team',
      rank: 3,
    };
  }
  if (request.reviewDecision === 'changes_requested') {
    return {
      at: 5,
      state: 'current',
      word: 'Changes requested',
      tone: 'danger',
      blocker: changesBlockerOf({ detail }),
      rank: 0,
    };
  }
  if (request.isDraft) {
    return {
      at: 3,
      state: 'current',
      word: 'Draft',
      tone: 'info',
      blocker:
        request.checks === 'success'
          ? 'Checks passed, ready to mark ready for review'
          : 'Not ready for review',
      rank: 3,
    };
  }
  if (request.reviewDecision === 'review_required') {
    return {
      at: 5,
      state: 'current',
      word: 'Review required',
      tone: 'warning',
      blocker: 'Waiting for a review',
      rank: 3,
    };
  }
  if (request.isMergeable === false) {
    const behind = behindPhraseOf({ fact });
    return {
      at: 5,
      state: 'current',
      word: request.reviewDecision === 'approved' ? 'Approved' : 'Conflicts',
      tone: 'warning',
      blocker:
        behind === null
          ? 'It cannot merge until it is rebased'
          : `${behind}, so it cannot merge yet`,
      rank: 1,
    };
  }
  const skips = skipsOf({ fact });
  const isChecksSkipped = skips.includes('checks');
  const isReviewSkipped = skips.includes('review');
  if (
    request.checks === 'success' ||
    request.reviewDecision === 'approved' ||
    (isChecksSkipped && isReviewSkipped)
  ) {
    return {
      at: 6,
      state: 'current',
      word: 'Ready to merge',
      tone: 'warning',
      blocker: readyBlockerOf({ request, isChecksSkipped, isReviewSkipped }),
      rank: 1,
    };
  }
  return {
    at: 3,
    state: 'current',
    word: 'Open',
    tone: 'neutral',
    blocker: isChecksSkipped ? 'No checks on this repo' : 'No check results yet',
    rank: 3,
  };
};

const localStandingOf = ({ fact }: FactParams): Standing => {
  const status = fact.status;
  if (status === null) {
    return { at: 0, state: 'current', word: 'Branch', tone: 'neutral', blocker: '', rank: 4 };
  }
  const ahead = status.ahead ?? 0;
  const push = status.push;
  if (status.isRebasing) {
    return {
      at: 1,
      state: 'ring',
      word: 'Rebasing',
      tone: 'info',
      blocker: `Rebasing on ${fact.baseBranch}`,
      rank: 3,
    };
  }
  if (push.kind === 'gone') {
    return {
      at: 2,
      state: 'ring',
      word: 'Branch gone',
      tone: 'warning',
      blocker: 'The remote branch was deleted',
      rank: 4,
    };
  }
  if (ahead === 0 && (push.kind === 'not-pushed' || push.kind === 'unknown')) {
    const changed = status.changedFiles ?? 0;
    return {
      at: 1,
      state: 'ring',
      word: 'Nothing committed',
      tone: 'neutral',
      blocker:
        changed > 0
          ? plural({ count: changed, one: 'file changed', many: 'files changed' })
          : 'No commits yet',
      rank: 4,
    };
  }
  if (push.kind === 'not-pushed') {
    return {
      at: 2,
      state: 'ring',
      word: 'Not pushed',
      tone: 'neutral',
      blocker: `${plural({ count: ahead, one: 'commit', many: 'commits' })} only on this Mac`,
      rank: 4,
    };
  }
  if (push.kind === 'ahead' || push.kind === 'diverged') {
    return {
      at: 2,
      state: 'ring',
      word: 'Not pushed',
      tone: 'neutral',
      blocker: `${plural({ count: push.ahead, one: 'new commit', many: 'new commits' })} not pushed`,
      rank: 4,
    };
  }
  return {
    at: 3,
    state: 'current',
    word: 'No PR yet',
    tone: 'warning',
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
      return { ...spec, name: spec.label, state: standing.state };
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
  const isBehindShown = fact.request !== null && fact.request.isMergeable === false;
  const staleNote = fact.isStale && fact.checkedAgo !== null ? `checked ${fact.checkedAgo}` : null;
  const blocker = isLive
    ? joinedOf({ parts: [liveWords, staleNote] })
    : joinedOf({
        parts: [
          standing.blocker,
          isOver || isBehindShown || standing.rank === 0 ? null : behindPhraseOf({ fact }),
        ],
      });
  let rank = standing.rank;
  if (rank > 1 && hasCard && !isOver) {
    rank = 1;
  }
  if (rank > 2 && isLive) {
    rank = 2;
  }
  return {
    steps: stepsOf({ standing, skips: skipsOf({ fact }) }),
    word: standing.word,
    tone: standing.tone,
    blocker,
    rank,
  };
};

type SentenceParams = {
  readonly fact: BranchFacts;
  readonly story: BranchStory;
  readonly hasCard: boolean;
};

export const branchSentenceOf = ({ fact, story, hasCard }: SentenceParams): string => {
  const request = fact.request === null ? '' : `, ${fact.request.noun}${fact.request.number}`;
  const skipped = story.steps.filter((step) => step.state === 'skipped');
  const skippedWords =
    skipped.length === 0 ? '' : ` ${skipped.map((step) => step.name).join(', ')}.`;
  const tail = `${skippedWords}${hasCard ? ' Has a card in Next.' : ''}`;
  const reason = story.blocker === '' ? '' : `, ${story.blocker}`;
  return `${fact.branch}, ${fact.projectName}${request}: ${story.word}${reason}.${tail}`;
};

export type BranchEntry = Readonly<{
  fact: BranchFacts;
  story: BranchStory;
  hasCard: boolean;
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
    hasCard: cardOrderByMountId.has(fact.mountId),
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
