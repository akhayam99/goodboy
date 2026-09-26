import type { Agent, AgentId, Workflow, WorkflowRunId } from '@goodboy/types';
import type { CrumbMenuAction, CrumbMenuModel, CrumbMenuRow } from '@goodboy/ui';
import type { AgentStateWord } from '../../agentStateWord';

type Params = {
  readonly workflow: Workflow;
  readonly runId: WorkflowRunId;
  readonly runTitle: string;
  readonly agents: ReadonlyArray<Agent>;
  readonly currentAgentId: AgentId;
  readonly stateOf: (agent: Agent) => AgentStateWord;
  readonly roleLabelOf: (agent: Agent | null, roleName: string | null) => string | null;
  readonly modelOf: (agent: Agent | null, stepModel: string | null) => string;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly onSelect: (agentId: AgentId) => void;
};

export const stepMenu = ({
  workflow,
  runId,
  runTitle,
  agents,
  currentAgentId,
  stateOf,
  roleLabelOf,
  modelOf,
  actions,
  onSelect,
}: Params): CrumbMenuModel => {
  const steps = workflow.steps
    .filter((step) => step.deletedAt == null)
    .sort((first, second) => first.ordinal - second.ordinal);
  const rows = steps.map((step, index): CrumbMenuRow => {
    const agent =
      agents.find(
        (candidate) =>
          candidate.workflowRunId === runId &&
          candidate.stepId === step.id &&
          candidate.parentAgentId == null,
      ) ?? null;
    const isStarted = agent !== null && agent.status !== 'pending';
    const state = agent === null ? null : stateOf(agent);
    return {
      id: step.id,
      lead: { kind: 'number', value: index + 1 },
      label: step.name,
      secondary: roleLabelOf(agent, step.role ?? null),
      metaA: modelOf(agent, step.modelOverride ?? null),
      state:
        isStarted && state !== null
          ? { word: state.word, tone: state.tone }
          : { word: 'Not started', tone: 'neutral' },
      isCurrent: agent?.id === currentAgentId,
      isDisabled: !isStarted,
      indent: 0,
      onSelect: () => {
        if (agent === null) {
          return;
        }
        onSelect(agent.id);
      },
    };
  });
  const position = rows.findIndex((row) => row.isCurrent);

  return {
    title: 'Steps',
    context: runTitle,
    count: position === -1 ? rows.length : `${position + 1} of ${rows.length}`,
    triggerLabel: 'Switch step',
    groups: [{ id: 'steps', label: null, rows }],
    actions: actions.slice(0, 2),
    width: 'regular',
    filterPlaceholder: null,
  };
};
