import type { DockGridMove } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { focusPanelHead } from './focusPanelHead';
import { toolKindOf } from './toolKindOf';

type Params = DockGridMove;

export const moveShellPanel = ({
  key,
  unit,
  target,
  isKeyboard = false,
}: Params): Promise<boolean> => {
  const kind = toolKindOf({ key });
  if (kind === undefined) {
    return Promise.resolve(false);
  }
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId;
  return state.moveDockPanel({ sessionId, kind, target, unit }).then((isMoved) => {
    if (isMoved && isKeyboard) {
      requestAnimationFrame(() =>
        focusPanelHead({
          key,
          isCurrent: () => useAppStore.getState().currentSessionId === sessionId,
        }),
      );
    }
    return isMoved;
  });
};
