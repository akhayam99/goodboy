import type { AutoTreeView } from '../../store/slices/auto-view/state';
import type { RowPhase } from '../workTreeModel/rowState';
import { isAutoPlanAwaitingApproval } from './isAutoPlanAwaitingApproval';
import { joinNouns } from './joinNouns';
import { openRoleNouns } from './openRoleNouns';

export type AutoRowFacts = Readonly<{
  phase: RowPhase;
  word: string;
  short: string;
}>;

type ViewParams = {
  readonly view: AutoTreeView;
};

export const autoRowFacts = ({ view }: ViewParams): AutoRowFacts | null => {
  switch (view.tree.phase) {
    case 'answering':
    case 'done':
      return null;
    case 'deciding':
      return { phase: 'running', word: 'Deciding what to do', short: 'Deciding' };
    case 'delegating':
      return { phase: 'running', word: 'Starting agents', short: 'Delegating' };
    case 'waiting': {
      if (isAutoPlanAwaitingApproval({ view })) {
        return { phase: 'waiting', word: 'Needs your approval', short: 'Needs you' };
      }
      const nouns = openRoleNouns({ delegations: view.delegations });
      return {
        phase: 'running',
        word: nouns.length === 0 ? 'Waiting' : `Waiting for ${joinNouns({ nouns })}`,
        short: 'Waiting',
      };
    }
    case 'merging':
      return { phase: 'running', word: 'Reading the results', short: 'Merging' };
    case 'blocked':
      return { phase: 'waiting', word: 'Blocked, open the chat', short: 'Blocked' };
    case 'stopping':
      return { phase: 'running', word: 'Stopping', short: 'Stopping' };
    case 'stopped':
      return { phase: 'closed', word: 'Stopped by you', short: 'Stopped' };
    default: {
      const exhaustive: never = view.tree.phase;
      return exhaustive;
    }
  }
};
