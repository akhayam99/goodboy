import type { CheckChainState } from '../../../store/slices/agents/selectCheckChain';
import type { ItemWorkState } from '../../live-state/itemWork/itemWorkWords';

export type CheckRowAction = 'reviewFix' | 'push' | 'retryFix' | 'retryAnalysis' | 'analyzeAgain';

type CheckRowResult = {
  readonly detail: string | null;
  readonly action: CheckRowAction | null;
};

type Params = {
  readonly state: ItemWorkState;
  readonly chain: CheckChainState;
  readonly commit: string | null;
  readonly cause: string | null;
  readonly isDismissed: boolean;
};

const STOPPED_FIX = 'You stopped the fix. Nothing changed on the branch.';

export const checkRowResultOf = ({
  state,
  chain,
  commit,
  cause,
  isDismissed,
}: Params): CheckRowResult => {
  const isAnalysis = chain === 'none' || chain === 'analyzing' || chain === 'no-fix';
  switch (state) {
    case 'starting':
      return {
        detail: isAnalysis ? 'Starting the Debugger' : 'Starting the Implementer',
        action: null,
      };
    case 'causeFound':
      return { detail: cause, action: 'reviewFix' };
    case 'fixedNotPushed':
      return {
        detail:
          commit === null
            ? 'Committed on the branch. Push it so the check runs again.'
            : `Committed ${commit}. Push it so the check runs again.`,
        action: 'push',
      };
    case 'pushedChecking':
      return {
        detail: commit === null ? 'The check runs again.' : `${commit}, the check runs again.`,
        action: null,
      };
    case 'fixed':
      return {
        detail: commit === null ? 'The check passed.' : `${commit} pushed, the check passed.`,
        action: null,
      };
    case 'failed':
      if (chain === 'fixed-pushed') {
        return {
          detail:
            commit === null
              ? 'The check failed again.'
              : `${commit} pushed, the check failed again.`,
          action: 'analyzeAgain',
        };
      }
      return isAnalysis
        ? { detail: 'The analysis ended with an error.', action: 'retryAnalysis' }
        : { detail: 'The fix ended without a commit.', action: 'retryFix' };
    case 'stopped':
      return isAnalysis
        ? { detail: 'You stopped the analysis.', action: 'retryAnalysis' }
        : { detail: STOPPED_FIX, action: 'retryFix' };
    case 'noFixFound':
      return {
        detail: isDismissed ? 'You dismissed the proposal.' : cause,
        action: 'analyzeAgain',
      };
    case 'queued':
    case 'analyzing':
    case 'fixing':
    case 'resolving':
    case 'inRun':
    case 'fixReady':
    case 'question':
    case 'appliedNotPushed':
    case 'pushed':
      return { detail: null, action: null };
    default: {
      const unexpected: never = state;
      return unexpected;
    }
  }
};
