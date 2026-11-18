import type { AgentStatus } from '@goodboy/types';
import type { CheckChainState } from '../../../store/slices/agents/selectCheckChain';
import type { ItemWorkState } from '../../live-state/itemWork/itemWorkWords';
import type { CheckOutcome } from './checkOutcomeOf';

type Params = {
  readonly chain: CheckChainState;
  readonly fixStatus: AgentStatus | null;
  readonly debuggerStatus: AgentStatus | null;
  readonly checkOutcome: CheckOutcome;
  readonly isStarting: boolean;
};

export const checkItemWorkStateOf = ({
  chain,
  fixStatus,
  debuggerStatus,
  checkOutcome,
  isStarting,
}: Params): ItemWorkState | null => {
  if (isStarting && chain !== 'analyzing' && chain !== 'fixing') {
    return 'starting';
  }
  switch (chain) {
    case 'none':
      return null;
    case 'analyzing':
      return 'analyzing';
    case 'proposal':
      return 'causeFound';
    case 'fixing':
      return 'fixing';
    case 'fixed-local':
      return 'fixedNotPushed';
    case 'fixed-pushed':
      if (checkOutcome === 'passed') {
        return 'fixed';
      }
      return checkOutcome === 'failed' ? 'failed' : 'pushedChecking';
    case 'fix-failed':
      return fixStatus === 'stopped' ? 'stopped' : 'failed';
    case 'no-fix':
      if (debuggerStatus === 'stopped') {
        return 'stopped';
      }
      return debuggerStatus === 'failed' ? 'failed' : 'noFixFound';
    default: {
      const unexpected: never = chain;
      return unexpected;
    }
  }
};
