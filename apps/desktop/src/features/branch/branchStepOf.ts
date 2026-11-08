import type { PullRequestPresentationState } from '../../shared/utils/pullRequestPresentation';
import type { CheckChainState } from '../../store/slices/agents/selectCheckChain';
import type { PullRequestNextStep } from './pullRequestNextStepOf';

export type BranchLifecycleStep = 'push' | Exclude<PullRequestNextStep, null> | null;

export type BranchStepKind =
  | 'answer'
  | 'apply'
  | 'retryPush'
  | 'fixComments'
  | 'pushCheckFix'
  | 'push'
  | 'publish'
  | 'startCheckFix'
  | 'fixChecks'
  | 'removeWorktree'
  | 'archiveSession'
  | Exclude<BranchLifecycleStep, null>;

export type BranchStep = BranchStepKind | 'working' | null;

export type BranchCommentFacts = {
  readonly questionThreadId: string | null;
  readonly waitingFixes: number;
  readonly fixable: number;
  readonly isFixRunLive: boolean;
};

export type BranchStepComments = {
  readonly facts: BranchCommentFacts;
  readonly readyThreadIds: ReadonlyArray<string>;
  readonly fixableThreadIds: ReadonlyArray<string>;
};

export type BranchCheckFacts = {
  readonly isFailing: boolean;
  readonly isAwaitingRun: boolean;
  readonly chain: CheckChainState;
};

export type BranchPushFacts = {
  readonly isInFlight: boolean;
  readonly failed: number;
  readonly canPush: boolean;
  readonly replies: number;
};

export type BranchClosingFacts = {
  readonly canRemove: boolean;
  readonly canArchive: boolean;
};

export const NO_CLOSING_FACTS: BranchClosingFacts = { canRemove: false, canArchive: false };

type Params = {
  readonly state: PullRequestPresentationState;
  readonly lifecycle: BranchLifecycleStep;
  readonly hasConflicts: boolean;
  readonly comments: BranchCommentFacts;
  readonly checks: BranchCheckFacts;
  readonly push: BranchPushFacts;
  readonly closing?: BranchClosingFacts;
};

export const NO_COMMENT_FACTS: BranchCommentFacts = {
  questionThreadId: null,
  waitingFixes: 0,
  fixable: 0,
  isFixRunLive: false,
};

const isCheckAgentLive = ({ chain }: Pick<BranchCheckFacts, 'chain'>): boolean =>
  chain === 'analyzing' || chain === 'fixing';

type OpenParams = Omit<Params, 'state'>;

export const OPEN_STEP_ORDER = [
  'pushing',
  'answer',
  'working',
  'apply',
  'retryPush',
  'fixComments',
  'pushCheckFix',
  'push',
  'publish',
  'rebase',
  'fixChecks',
] as const;

export type OpenStepKey = (typeof OPEN_STEP_ORDER)[number];

const OPEN_STEP_DUE: Readonly<Record<OpenStepKey, (params: OpenParams) => boolean>> = {
  pushing: ({ push }) => push.isInFlight,
  answer: ({ comments }) => comments.questionThreadId !== null,
  working: ({ comments, checks }) => comments.isFixRunLive || isCheckAgentLive(checks),
  apply: ({ comments }) => comments.waitingFixes > 0,
  retryPush: ({ push }) => push.failed > 0,
  fixComments: ({ comments }) => comments.fixable > 0,
  pushCheckFix: ({ checks }) => checks.isFailing && checks.chain === 'fixed-local',
  push: ({ push }) => push.canPush,
  publish: ({ push }) => push.replies > 0,
  rebase: ({ hasConflicts, lifecycle }) => hasConflicts && lifecycle === 'rebase',
  fixChecks: ({ checks }) => checks.isFailing && !checks.isAwaitingRun,
};

const OPEN_STEP_OF: Readonly<Record<OpenStepKey, (params: OpenParams) => BranchStep>> = {
  pushing: () => 'push',
  answer: () => 'answer',
  working: () => 'working',
  apply: () => 'apply',
  retryPush: () => 'retryPush',
  fixComments: () => 'fixComments',
  pushCheckFix: () => 'pushCheckFix',
  push: () => 'push',
  publish: () => 'publish',
  rebase: () => 'rebase',
  fixChecks: ({ checks }) => (checks.chain === 'proposal' ? 'startCheckFix' : 'fixChecks'),
};

type RankParams = {
  readonly key: OpenStepKey;
};

export const openStepRankOf = ({ key }: RankParams): number => OPEN_STEP_ORDER.indexOf(key);

const openStepOf = ({
  lifecycle,
  hasConflicts,
  comments,
  checks,
  push,
}: OpenParams): BranchStep => {
  const facts = { lifecycle, hasConflicts, comments, checks, push };
  const due = OPEN_STEP_ORDER.find((key) => OPEN_STEP_DUE[key](facts));
  return due === undefined ? lifecycle : OPEN_STEP_OF[due](facts);
};

const startStepOf = ({ lifecycle, comments, checks }: OpenParams): BranchStep => {
  if (comments.questionThreadId !== null) {
    return 'answer';
  }
  if (comments.isFixRunLive || isCheckAgentLive(checks)) {
    return 'working';
  }
  if (comments.waitingFixes > 0) {
    return 'apply';
  }
  return comments.fixable > 0 ? 'fixComments' : lifecycle;
};

const queuedStepOf = ({ push }: Pick<OpenParams, 'push'>): BranchStep => {
  if (push.isInFlight) {
    return 'push';
  }
  if (push.failed > 0) {
    return 'retryPush';
  }
  if (push.canPush) {
    return 'push';
  }
  return push.replies > 0 ? 'publish' : null;
};

type MergedParams = {
  readonly closing: BranchClosingFacts;
};

const mergedStepOf = ({ closing }: MergedParams): BranchStep => {
  if (closing.canRemove) {
    return 'removeWorktree';
  }
  return closing.canArchive ? 'archiveSession' : null;
};

export const branchStepOf = ({
  state,
  lifecycle,
  hasConflicts,
  comments,
  checks,
  push,
  closing = NO_CLOSING_FACTS,
}: Params): BranchStep => {
  switch (state) {
    case 'none':
      return startStepOf({ lifecycle, hasConflicts, comments, checks, push });
    case 'merged':
      return mergedStepOf({ closing });
    case 'queued':
      return queuedStepOf({ push });
    case 'closed':
      return lifecycle;
    case 'draft':
    case 'open':
    case 'approved':
      return openStepOf({ lifecycle, hasConflicts, comments, checks, push });
    default: {
      const unexpected: never = state;
      return unexpected;
    }
  }
};
