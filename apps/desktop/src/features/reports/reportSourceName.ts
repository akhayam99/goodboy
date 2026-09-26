import type { Agent, ArtifactKind, SessionArtifact } from '@goodboy/types';
import { classifyAgent, KIND_TO_ROLE, ROLE_LABEL } from '../session/agent-kind';

type ReportSource =
  | Readonly<{ kind: 'agent'; agent: Pick<Agent, 'id' | 'name' | 'kind'> }>
  | Readonly<{ kind: 'artifact'; artifact: Pick<SessionArtifact, 'id' | 'title' | 'kind'> }>;

type ReportSourceNameParams = Readonly<{
  source: ReportSource;
}>;

const ARTIFACT_SOURCE_LABEL: Record<ArtifactKind, string> = {
  plan: 'Plan',
  report: 'Report',
  wireframe: 'Wireframe',
};

type AgentRoleLabelParams = Readonly<{
  agent: Pick<Agent, 'name' | 'kind'>;
}>;

const agentRoleLabel = ({ agent }: AgentRoleLabelParams): string | null => {
  if (agent.kind === undefined || agent.kind === null) {
    return null;
  }
  const kind = classifyAgent({ agent, override: null });
  if (kind === 'generic') {
    return null;
  }
  const label = ROLE_LABEL[KIND_TO_ROLE[kind]];
  if (agent.name.toLowerCase().includes(label.toLowerCase())) {
    return null;
  }
  return label;
};

export const reportSourceName = ({ source }: ReportSourceNameParams): string => {
  if (source.kind === 'agent') {
    const name = source.agent.name.trim();
    if (name === '') {
      return `agent ${source.agent.id}`;
    }
    const role = agentRoleLabel({ agent: source.agent });
    if (role === null) {
      return name;
    }
    return `${name} (${role})`;
  }
  const title = source.artifact.title.trim();
  if (title === '') {
    return `${source.artifact.kind} ${source.artifact.id}`;
  }
  return `${title} (${ARTIFACT_SOURCE_LABEL[source.artifact.kind]})`;
};
