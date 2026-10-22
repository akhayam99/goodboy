import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { autoRootsOf } from '../../auto/autoRootsOf';
import { moveToAuto } from '../../auto/moveToAuto';
import { agentKindPalette, type AgentKind } from '../agent-kind';
import { RUN_ROUTE_COPY } from './runRouteCopy';
import { startRoutedRun } from './startRoutedRun';

type Params = {
  readonly sessionId: SessionId;
  readonly role: AgentKind;
  readonly work: string;
  readonly sourceAgentId: AgentId | null;
};

export type ContinueOutcome = Readonly<{
  kind: 'message' | 'handed' | 'started';
  agentId: AgentId;
}>;

type MessageParams = {
  readonly label: string;
  readonly work: string;
};

const continueMessageOf = ({ label, work }: MessageParams): string => {
  const trimmed = work.trim();
  return trimmed === '' ? `Continue with ${label}.` : `Continue with ${label}: ${trimmed}`;
};

export const continueWithRole = async ({
  sessionId,
  role,
  work,
  sourceAgentId,
}: Params): Promise<ContinueOutcome> => {
  const label = agentKindPalette({ kind: role }).label;
  const content = continueMessageOf({ label, work });
  if (sourceAgentId !== null) {
    const outcome = await moveToAuto({ sessionId, agentId: sourceAgentId, instruction: content });
    if (outcome.kind === 'adopted') {
      return { kind: 'handed', agentId: outcome.autoAgentId };
    }
    if (outcome.kind === 'exists') {
      await useAppStore.getState().sendTurn({ sessionId, agentId: outcome.autoAgentId, content });
      return { kind: 'message', agentId: outcome.autoAgentId };
    }
    throw new Error(outcome.message);
  }
  const state = useAppStore.getState();
  const [root] = autoRootsOf({
    agents: state.sessionPhaseRuns[sessionId] ?? [],
    kindOverride: state.agentKindOverride,
  });
  if (root !== undefined) {
    await state.sendTurn({ sessionId, agentId: root.id, content });
    return { kind: 'message', agentId: root.id };
  }
  const run = await startRoutedRun({
    sessionId,
    result: {
      ask: work.trim() === '' ? content : work.trim(),
      preset: null,
      role,
      route: {
        shape: 'lead',
        row: 1,
        presetName: null,
        closeness: null,
        role,
        choice: label,
        why: RUN_ROUTE_COPY.why.picked,
      },
    },
  });
  if (run.kind !== 'lead') {
    throw new Error(RUN_ROUTE_COPY.failed);
  }
  return { kind: 'started', agentId: run.agentId };
};
