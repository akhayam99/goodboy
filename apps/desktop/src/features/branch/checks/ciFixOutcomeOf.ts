import type { CheckChainState } from '../../../store/slices/agents/selectCheckChain';
import type { CheckOutcome } from './checkOutcomeOf';
import { fixOutcomeText } from './fixOutcomeText';

export type CiFixOutcome = {
  readonly headline: string | null;
  readonly detail: string;
  readonly tone: 'success' | 'warning' | 'danger' | 'neutral';
  readonly isPulsing: boolean;
};

type Params = {
  readonly state: CheckChainState;
  readonly commit: string | null;
  readonly checkName: string | null;
  readonly checkOutcome: CheckOutcome;
  readonly isDismissed: boolean;
};

const DISMISSED = 'Dismissed. Analyze again for another proposal.';

export const ciFixOutcomeOf = ({
  state,
  commit,
  checkName,
  checkOutcome,
  isDismissed,
}: Params): CiFixOutcome | null => {
  const subject = checkName ?? 'The check';
  const detail = fixOutcomeText({ state, commit, checkName });
  switch (state) {
    case 'fixing':
      return {
        headline: `Fixing ${subject}`,
        detail: detail ?? '',
        tone: 'warning',
        isPulsing: true,
      };
    case 'fixed-local':
      return {
        headline: `${subject} is fixed on your branch`,
        detail: detail ?? '',
        tone: 'success',
        isPulsing: false,
      };
    case 'fixed-pushed': {
      const pushed = commit === null ? 'Pushed.' : `Pushed ${commit}.`;
      if (checkOutcome === 'passed') {
        return {
          headline: `${subject} passed`,
          detail: `${pushed} The fix worked.`,
          tone: 'success',
          isPulsing: false,
        };
      }
      if (checkOutcome === 'failed') {
        return {
          headline: `${subject} still fails`,
          detail: `${pushed} The check failed again. Nothing runs by itself.`,
          tone: 'danger',
          isPulsing: false,
        };
      }
      return {
        headline: `${subject} is running again`,
        detail: detail ?? '',
        tone: 'warning',
        isPulsing: true,
      };
    }
    case 'fix-failed':
      return { headline: null, detail: detail ?? '', tone: 'danger', isPulsing: false };
    case 'none':
    case 'analyzing':
    case 'proposal':
    case 'no-fix':
      return isDismissed
        ? { headline: null, detail: DISMISSED, tone: 'neutral', isPulsing: false }
        : null;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};
