import type { Agent, AgentId } from '@goodboy/types';
import { agentPlace } from '../../../../store';
import {
  AGENT_KIND_PALETTE,
  KIND_TO_ROLE,
  ROLE_LABEL,
  classifyAgent,
  resolveRootAgent,
} from '../../agent-kind';
import { agentStateWord } from '../../agentStateWord';
import { isAgentMissingArtifact } from '../../../artifacts/turnArtifactOutcome';
import { settledResolverAgentIds } from '../../../review/settledResolverAgentIds';
import { selectResolverAgentIds } from '../../../review/selectResolverAgentIds';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import type { AttachedRun } from '../../../workflows/activeWorkflowRuns';
import type { TrailMenuInputs } from './trailMenuInputs';

export type TrailMenuScope = TrailMenuInputs & {
  readonly kindOf: (agent: Agent) => ReturnType<typeof classifyAgent>;
  readonly stateOf: (agent: Agent) => ReturnType<typeof agentStateWord>;
  readonly roleOf: (agent: Agent) => { readonly label: string; readonly tone: string };
  readonly toAgent: (agentId: AgentId) => void;
  readonly runTitleOf: (entry: AttachedRun) => string;
  readonly resolvers: ReadonlySet<AgentId>;
  readonly selected: Agent | null;
  readonly parent: Agent | null;
  readonly root: Agent | null;
};

export const createTrailMenuScope = (inputs: TrailMenuInputs): TrailMenuScope => {
  const { sessionId, phaseRuns, kindOverride, resolveAttempts, signals, artifacts, navigate } =
    inputs;
  const kindOf = (agent: Agent) =>
    classifyAgent({ agent, override: kindOverride[agent.id] ?? null });
  const settled = settledResolverAgentIds({ attempts: resolveAttempts });
  const activeParents = new Set(
    phaseRuns.flatMap((agent) =>
      agent.parentAgentId != null && (agent.status === 'pending' || agent.status === 'running')
        ? [agent.parentAgentId]
        : [],
    ),
  );
  const stateOf = (agent: Agent) =>
    agentStateWord({
      agent,
      hasOpenQuestion: signals.openQuestionAgentIds.has(agent.id),
      isTurnLive: signals.liveTurnAgentIds.has(agent.id),
      hasActiveChild: activeParents.has(agent.id),
      isResolverSettled: settled.has(agent.id),
      isMissingArtifact: isAgentMissingArtifact({ agent, kind: kindOf(agent), artifacts }),
    });
  const roleOf = (agent: Agent) => {
    const kind = kindOf(agent);
    return { label: ROLE_LABEL[KIND_TO_ROLE[kind]], tone: AGENT_KIND_PALETTE[kind].fg };
  };
  const toAgent = (agentId: AgentId) => navigate({ to: agentPlace({ sessionId, agentId }) });
  const selected = phaseRuns.find((agent) => agent.id === inputs.selectedAgentId) ?? null;
  const parent =
    selected?.parentAgentId == null
      ? null
      : (phaseRuns.find((agent) => agent.id === selected.parentAgentId) ?? null);
  const root =
    parent?.parentAgentId == null
      ? null
      : resolveRootAgent({ agents: phaseRuns, agentId: parent.id });

  return {
    ...inputs,
    kindOf,
    stateOf,
    roleOf,
    toAgent,
    runTitleOf: (entry) => entry.run.title ?? workflowKindName(entry.workflow),
    resolvers: selectResolverAgentIds({ agents: phaseRuns, kindOverride }),
    selected,
    parent,
    root,
  };
};
