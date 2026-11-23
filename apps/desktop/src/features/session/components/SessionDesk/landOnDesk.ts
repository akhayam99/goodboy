import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { DeskTool, LandingMove } from '../../../../store/slices/navigation/landingOf';
import { deskLandingOf } from './deskLandingOf';
import { deskToolsOf } from './deskToolsOf';
import { startDeskTool } from './startDeskTool';
import { deskLines } from './useDeskOwner/deskLines';

type Params = {
  readonly sessionId: SessionId;
  readonly next: ReadonlyArray<LandingMove>;
};

type ToolParams = {
  readonly sessionId: SessionId;
  readonly tool: DeskTool;
};

const openDeskTool = ({ sessionId, tool }: ToolParams): void => {
  if (tool.kind !== 'terminal') {
    return;
  }
  void startDeskTool({ sessionId, mountId: tool.mountId });
};

const hasTools = (): boolean => deskToolsOf({ state: useAppStore.getState() }).length > 0;

export const landOnDesk = ({ sessionId, next }: Params): boolean => {
  if (hasTools()) {
    return true;
  }
  const kept = deskLines.keptOf({ sessionId });
  deskLines.dropKept({ sessionId });
  kept.forEach((tool) => useAppStore.getState().openDrawer(tool));
  if (hasTools()) {
    return true;
  }
  const state = useAppStore.getState();
  const landing = deskLandingOf({ state, sessionId, door: 'desk', move: null, next });
  if (landing.face === 'overview') {
    state.setSessionFace({ sessionId, face: 'overview' });
    return false;
  }
  if (landing.isKept) {
    return true;
  }
  landing.tools.forEach((tool) => openDeskTool({ sessionId, tool }));
  return true;
};
