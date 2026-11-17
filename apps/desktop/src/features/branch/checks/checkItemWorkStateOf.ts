import type { AgentStatus } from '@goodboy/types';
import type { CheckChainState } from '../../../store/slices/agents/selectCheckChain';
import type { ItemWorkState } from '../../live-state/itemWork/itemWorkWords';

type Params = {
  readonly chain: CheckChainState;
  readonly fixStatus: AgentStatus | null;
  readonly isStarting: boolean;
};

export const checkItemWorkStateOf = ({
  chain,
  fixStatus,
  isStarting,
}: Params): ItemWorkState | null => {
  if (isStarting && (chain === 'none' || chain === 'no-fix')) {
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
      return 'pushedChecking';
    case 'fix-failed':
      return fixStatus === 'stopped' ? 'stopped' : 'failed';
    case 'no-fix':
      return 'noFixFound';
    default: {
      const unexpected: never = chain;
      return unexpected;
    }
  }
};
