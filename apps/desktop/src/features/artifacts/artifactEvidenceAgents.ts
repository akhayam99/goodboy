import type { Agent, AgentId, TurnEvent } from '@goodboy/types';

export type ArtifactEvidenceAgentsParams = Readonly<{
  agents: ReadonlyArray<Agent>;
  transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  executingAgentId: AgentId | null;
}>;

const hasRecordedOutput = ({ events }: { readonly events: ReadonlyArray<TurnEvent> }): boolean =>
  events.some((event) => event.kind === 'assistant_text' && event.delta.trim().length > 0);

export const artifactEvidenceAgents = ({
  agents,
  transcripts,
  executingAgentId,
}: ArtifactEvidenceAgentsParams): ReadonlyArray<Agent> =>
  agents.filter((agent) => {
    if (agent.id === executingAgentId) {
      return false;
    }
    if (agent.status !== 'pending') {
      return true;
    }
    return hasRecordedOutput({ events: transcripts[agent.id] ?? [] });
  });
