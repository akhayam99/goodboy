import type { BranchDueStep } from '../../../branchStepOf';

export type VerdictStepFacts = {
  readonly base: string;
  readonly changesBy: string | null;
  readonly failing: number;
  readonly hasConflicts: boolean;
  readonly isRebasing: boolean;
  readonly mergeWord: string;
};

type Params = {
  readonly step: BranchDueStep;
  readonly facts: VerdictStepFacts;
};

export const verdictStepTextOf = ({ step, facts }: Params): string => {
  switch (step) {
    case 'answer':
      return facts.changesBy === null ? 'answer the comments' : `answer ${facts.changesBy}`;
    case 'working':
      return 'let the running fix finish';
    case 'apply':
      return 'apply the waiting fixes';
    case 'retryPush':
      return 'retry the push';
    case 'fixComments':
      return 'fix the comments';
    case 'pushCheckFix':
      return 'push the check fix';
    case 'push':
      return 'push your commits';
    case 'publish':
      return 'publish your replies';
    case 'startCheckFix':
      return 'start the check fix';
    case 'fixChecks':
      return facts.failing === 1 ? 'fix the failing check' : 'fix the failing checks';
    case 'rebase':
      if (facts.hasConflicts) {
        return `resolve the conflicts with ${facts.base}`;
      }
      return facts.isRebasing ? 'finish the rebase' : `rebase onto ${facts.base}`;
    case 'markReady':
      return 'mark it ready for review';
    case 'requestReview':
      return facts.changesBy === null
        ? 'ask for a review'
        : `ask ${facts.changesBy} to review again`;
    case 'merge':
      return `${facts.mergeWord.charAt(0).toLowerCase()}${facts.mergeWord.slice(1)}`;
    case 'review':
      return 'review it';
    case 'reopen':
      return 'reopen it';
    case 'removeWorktree':
      return 'remove the worktree';
    case 'archiveSession':
      return 'archive the session';
    default: {
      const unexpected: never = step;
      return unexpected;
    }
  }
};
