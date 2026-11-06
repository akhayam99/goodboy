import type { AgentId, SessionId } from '@goodboy/types';
import { AGENT_KIND_META, classifyAgent } from '../../../features/session/agent-kind';
import { useAppStore } from '../../index';

type Params = {
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

export const useAskerNoun = ({ sessionId, agentId }: Params): string | null =>
  useAppStore((state) => {
    const asker =
      sessionId === null || agentId === null
        ? null
        : ((state.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId) ?? null);
    return asker === null
      ? null
      : AGENT_KIND_META[
          classifyAgent({ agent: asker, override: state.agentKindOverride[asker.id] ?? null })
        ].noun;
  });
