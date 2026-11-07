import { NAMES } from '../../shared/utils/names';
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
      return null;
    case 'done':
      return { phase: 'done', word: 'Idle', short: 'Idle' };
    case 'deciding':
      return { phase: 'running', word: 'Deciding what to do', short: 'Deciding' };
    case 'delegating':
      return { phase: 'running', word: 'Starting agents', short: 'Starting' };
    case 'waiting': {
      if (isAutoPlanAwaitingApproval({ view })) {
        return { phase: 'waiting', word: NAMES.needsYou, short: NAMES.needsYou };
      }
      const nouns = openRoleNouns({ delegations: view.delegations });
      return {
        phase: 'running',
        word: nouns.length === 0 ? 'Waiting' : `Waiting for ${joinNouns({ nouns })}`,
        short: 'Waiting',
      };
    }
    case 'merging':
      return { phase: 'running', word: 'Reading the results', short: 'Reading' };
    case 'blocked':
      return { phase: 'failed', word: NAMES.failed, short: NAMES.failed };
    case 'stopping':
      return { phase: 'running', word: 'Stopping', short: 'Stopping' };
    case 'stopped':
      return { phase: 'closed', word: 'Stopped by you', short: 'Stopped' };
    case 'finished':
      return { phase: 'closed', word: NAMES.done, short: NAMES.done };
    default: {
      const exhaustive: never = view.tree.phase;
      return exhaustive;
    }
  }
};
