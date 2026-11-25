import { useAppStore } from '../../../store/store';
import { discardUncreatedSession } from '../../../store/slices/sessions/discardUncreatedSession';
import { applyStartEdits } from '../../session/startRun/applyStartEdits';
import { guidanceToSendOf } from '../../session/startRun/guidanceToSendOf';
import { pickedRouteOf } from '../../session/startRun/pickedRouteOf';
import { startRoutedRun } from '../../session/startRun/startRoutedRun';
import { workspaceGuidanceOf } from '../../session/startRun/workspaceGuidanceOf';
import type { StartShape } from '../../../store/slices/sessionDraft/state';
import type { StartKind } from '../contract/vocabulary';
import type { StartPorts } from './handlerTypes';

const SHAPE_OF: Readonly<Record<StartKind, StartShape>> = {
  lead: 'orchestrated',
  leadPlan: 'preset',
  agentScout: 'agent',
};

type Params = {
  readonly resolveTask: StartPorts['resolveTask'];
};

export const startPortsOf = ({ resolveTask }: Params): StartPorts => ({
  resolveTask,
  launch: async ({ sessionId, mode, startKind, preset, ask, limit }) => {
    await applyStartEdits({ sessionId, mode });
    const state = useAppStore.getState();
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined) {
      throw new Error('The session is no longer here');
    }
    const shape = SHAPE_OF[startKind];
    await startRoutedRun({
      sessionId,
      result: pickedRouteOf({ shape, ask, preset, closeness: 'adapt', role: 'scout' }),
      level: null,
      limit,
      guidance: guidanceToSendOf({
        picked: null,
        workspace: workspaceGuidanceOf({ state, workspaceId: session.workspaceId }),
      }),
    });
  },
  discard: async ({ sessionId }) => {
    await discardUncreatedSession({ set: useAppStore.setState, sessionId });
  },
});
