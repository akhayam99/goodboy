import type { FixChecksProgress, SessionSuggestion } from './types';

type Params = {
  readonly suggestion: SessionSuggestion;
};

type ProgressParams = {
  readonly progress: FixChecksProgress | null;
};

const isCheckRunFollowUp = ({ progress }: ProgressParams): boolean => {
  if (progress === null) {
    return false;
  }
  switch (progress.chain) {
    case 'none':
    case 'no-fix':
      return false;
    case 'fixed-pushed':
      return progress.outcome !== 'failed';
    case 'analyzing':
    case 'proposal':
    case 'fixing':
    case 'fixed-local':
    case 'fix-failed':
      return true;
    default: {
      const exhaustive: never = progress.chain;
      return exhaustive;
    }
  }
};

export const isOfferedByActivity = ({ suggestion }: Params): boolean => {
  switch (suggestion.kind) {
    case 'fix-checks':
      return isCheckRunFollowUp({ progress: suggestion.payload.progress ?? null });
    case 'workflow-next-step':
      return true;
    case 'plan-ready':
    case 'resolve-threads':
    case 'rebase-project':
    case 'answer-questions':
    case 'mount-project':
    case 'approve-tool':
    case 'sign-in':
    case 'retry-agent':
    case 'resume-agents':
    case 'push-branch':
    case 'open-pr':
    case 'mark-ready':
    case 'merge-pr':
    case 'check-changes':
    case 'close-worktree':
    case 'continue-with-workflow':
      return false;
    default: {
      const exhaustive: never = suggestion;
      return exhaustive;
    }
  }
};
