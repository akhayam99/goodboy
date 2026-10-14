import type { CheckChainState } from '../../../store/slices/agents/selectCheckChain';

type Params = {
  readonly state: CheckChainState;
  readonly commit: string | null;
  readonly checkName: string | null;
};

export const fixOutcomeText = ({ state, commit, checkName }: Params): string | null => {
  const subject = checkName ?? 'The check';
  switch (state) {
    case 'fixing':
      return 'Implementer is applying it on the branch.';
    case 'fixed-local':
      return commit === null
        ? 'Committed on the branch, not pushed yet.'
        : `Committed ${commit} on the branch, not pushed yet.`;
    case 'fixed-pushed':
      return commit === null
        ? `Pushed. ${subject} runs again.`
        : `Pushed ${commit}. ${subject} runs again.`;
    case 'fix-failed':
      return 'The fix ended without a commit. Open the Implementer to see why.';
    case 'none':
    case 'analyzing':
    case 'proposal':
    case 'no-fix':
      return null;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};
