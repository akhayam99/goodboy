import type { DockGridMove } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { toolKindOf } from './toolKindOf';

type Params = DockGridMove;

export const moveShellPanel = ({ key, unit, target }: Params): void => {
  const kind = toolKindOf({ key });
  if (kind === undefined) {
    return;
  }
  const state = useAppStore.getState();
  void state.moveDockPanel({ sessionId: state.currentSessionId, kind, target, unit });
};
