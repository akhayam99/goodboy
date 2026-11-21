import type { DockGridMove } from '@goodboy/ui';
import { useAppStore } from '../../store';
import type { WorkspaceToolKind } from '../../store/slices/drawer/state';

type Params = DockGridMove;

const TOOL_KINDS: ReadonlyArray<WorkspaceToolKind> = ['terminal', 'browser', 'monitoring'];

export const moveShellPanel = ({ key, target }: Params): void => {
  const kind = TOOL_KINDS.find((known) => known === key);
  if (kind === undefined) {
    return;
  }
  const state = useAppStore.getState();
  void state.moveDockPanel({ sessionId: state.currentSessionId, kind, target });
};
