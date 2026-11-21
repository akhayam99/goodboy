import type { MoveGroup, SessionSuggestion } from './types';

type Params = {
  readonly suggestion: SessionSuggestion;
};

export const moveGroupOf = ({ suggestion }: Params): MoveGroup => {
  switch (suggestion.kind) {
    case 'close-worktree':
    case 'unmount-folder':
    case 'archive-session':
      return 'upkeep';
    case 'answer-questions':
    case 'approve-tool':
    case 'sign-in':
    case 'resume-agents':
    case 'retry-agent':
    case 'mount-project':
    case 'fix-checks':
    case 'rerun-check':
    case 'ask-agent':
    case 'resolve-threads':
    case 'merge-pr':
    case 'workflow-next-step':
      return 'unblock';
    case 'rebase-project':
      return suggestion.priority < 40 ? 'unblock' : 'advance';
    case 'plan-ready':
    case 'push-branch':
    case 'open-pr':
    case 'mark-ready':
    case 'merge-series':
    case 'check-changes':
    case 'move-tracker-item':
    case 'continue-with-workflow':
    case 'run-failing-test':
    case 'next-script':
      return 'advance';
    default: {
      const exhaustive: never = suggestion;
      return exhaustive;
    }
  }
};
