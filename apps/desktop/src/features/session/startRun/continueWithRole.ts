import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { readRunGuidance } from '../../../store/runtime/runGuidance/readRunGuidance';
import { tauriDatabase } from '../../../shared/lib/db';
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
  readonly guidance?: string | null;
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
  guidance = null,
}: Params): Promise<ContinueOutcome> => {
  const label = agentKindPalette({ kind: role }).label;
  const content = continueMessageOf({ label, work });
  if (sourceAgentId !== null) {
    const workspaceId = sessionById(useAppStore.getState().sessions, sessionId)?.workspaceId;
    const carried =
      guidance ??
      (workspaceId === undefined
        ? null
        : await readRunGuidance({ db: tauriDatabase, workspaceId, agentId: sourceAgentId }));
    const outcome = await moveToAuto({
      sessionId,
      agentId: sourceAgentId,
      instruction: content,
      guidance: carried,
    });
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
    guidance,
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
