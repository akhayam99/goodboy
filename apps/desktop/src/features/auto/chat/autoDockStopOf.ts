import type { Agent, TurnState } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { pluralize } from '../../../shared/utils/pluralize';
import { NAMES } from '../../../shared/utils/names';
import type { ConversationStop } from '../../../shared/types/conversationStop';
import { autoTreeLive } from '../../live-state/adapters/autoTreeLive';
import { autoGlanceOf } from '../glance/autoGlanceOf';
import { openDelegationCountOf } from './openDelegationCountOf';

type Params = {
  readonly view: AutoTreeView;
  readonly rootTurn: TurnState | null;
  readonly rootAgent: Pick<Agent, 'status' | 'stoppedBy' | 'stoppedAt'>;
  readonly isStopping: boolean;
  readonly stop: () => void;
};

type ViewParams = {
  readonly view: AutoTreeView;
};

const stopAutoLabelOf = ({ view }: ViewParams): string => {
  const count = openDelegationCountOf({ view });
  return count === 0 ? NAMES.stopAuto : `${NAMES.stopAuto} and ${pluralize(count, 'agent')}`;
};

export const autoDockStopOf = ({
  view,
  rootTurn,
  rootAgent,
  isStopping,
  stop,
}: Params): ConversationStop | null => {
  const facts = autoTreeLive({ view, rootTurn, rootAgent, lastTool: null, project: null });
  const isTreeStopping = isStopping || view.tree.phase === 'stopping';
  if (!isTreeStopping && facts?.actions.some((action) => action.id === 'stopAuto') !== true) {
    return null;
  }
  const glance = autoGlanceOf({ view, rootTurn });
  const isRootLive = rootTurn?.kind === 'running' || rootTurn?.kind === 'starting';
  const isAttention = facts?.state === 'paused' || facts?.state === 'failed';
  return {
    label: stopAutoLabelOf({ view }),
    phase: isTreeStopping ? 'stopping' : 'idle',
    sentence: isRootLive || (glance.isLive && !isAttention) ? glance.sentence : '',
    stop,
  };
};
