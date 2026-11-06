import type { TurnState } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { autoGlanceOf } from './autoGlanceOf';

type Params = {
  readonly view: AutoTreeView;
  readonly rootTurn: TurnState | null;
};

export const isAutoDockSpeaking = ({ view, rootTurn }: Params): boolean => {
  const { state } = autoGlanceOf({ view, rootTurn });
  if (state === 'working' || state === 'planning') {
    return true;
  }
  return state === 'waiting' && isAutoPlanAwaitingApproval({ view });
};
