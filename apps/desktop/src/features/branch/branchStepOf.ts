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

const openStepOf = ({
  lifecycle,
  hasConflicts,
  comments,
  checks,
  push,
}: OpenParams): BranchStep => {
  if (push.isInFlight) {
    return 'push';
  }
  if (comments.questionThreadId !== null) {
    return 'answer';
  }
  if (comments.isFixRunLive || isCheckAgentLive(checks)) {
    return 'working';
  }
  if (comments.waitingFixes > 0) {
    return 'apply';
  }
  if (push.failed > 0) {
    return 'retryPush';
  }
  if (comments.fixable > 0) {
    return 'fixComments';
  }
  if (checks.isFailing && checks.chain === 'fixed-local') {
    return 'pushCheckFix';
  }
  if (push.canPush) {
    return 'push';
  }
  if (push.replies > 0) {
    return 'publish';
  }
  if (hasConflicts && lifecycle === 'rebase') {
    return 'rebase';
  }
  if (checks.isFailing && !checks.isAwaitingRun) {
    return checks.chain === 'proposal' ? 'startCheckFix' : 'fixChecks';
  }
  return lifecycle;
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
