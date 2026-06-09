import type { Agent, AgentId, Skill, Workflow, WorkspaceScript } from '@goodboy/types';
import { AGENT_KIND_META, inferAgentKindFromName, type AgentKind } from '../session/agent-kind';
import type { QuickActionItem } from './types';

function firstLine(body: string): string | undefined {
  const line = body.trim().split('\n', 1)[0]?.trim();
  return line ? line : undefined;
}

export const buildScriptActions = (
  scripts: ReadonlyArray<WorkspaceScript>,
  onPick: (script: WorkspaceScript) => void,
): ReadonlyArray<QuickActionItem> => {
  return scripts.map((script) => ({
    id: `script:${script.id}`,
    label: script.name,
    sublabel: firstLine(script.body),
    group: 'script',
    perform: () => onPick(script),
  }));
};

export const buildSkillActions = (
  skills: ReadonlyArray<Skill>,
  onPick: (skill: Skill) => void,
): ReadonlyArray<QuickActionItem> => {
  return skills.map((skill) => ({
    id: `skill:${skill.id}`,
    label: skill.name,
    sublabel: skill.description || undefined,
    group: 'skill',
    perform: () => onPick(skill),
  }));
};

export const buildWorkflowActions = (
  workflows: ReadonlyArray<Workflow>,
  onPick: (workflow: Workflow) => void,
): ReadonlyArray<QuickActionItem> => {
  return workflows.map((workflow) => ({
    id: `workflow:${workflow.id}`,
    label: workflow.name,
    sublabel:
      workflow.description ||
      `${workflow.steps.length} step${workflow.steps.length === 1 ? '' : 's'}`,
    group: 'workflow',
    perform: () => onPick(workflow),
  }));
};

export const buildAgentActions = (
  agents: ReadonlyArray<Agent>,
  kindOverride: Readonly<Record<AgentId, AgentKind>>,
  onSwitch: (agent: Agent) => void,
  onSpawn: () => void,
): ReadonlyArray<QuickActionItem> => {
  const switches = agents
    .filter((agent) => agent.deletedAt === undefined)
    .map<QuickActionItem>((agent) => {
      // Authoritative source: agentKindOverride is populated by the workflow
      // step that spawned the agent. Fall back to name-based inference for
      // ad-hoc agents created without a workflow context.
      const kind = kindOverride[agent.id] ?? inferAgentKindFromName(agent.name);
      return {
        id: `agent:${agent.id}`,
        label: agent.name,
        sublabel: agent.status,
        trailing: { label: AGENT_KIND_META[kind].label, kind },
        group: 'agent',
        perform: () => onSwitch(agent),
      };
    });
  return [
    ...switches,
    { id: 'agent:spawn', label: '+ new agent', group: 'agent', perform: onSpawn },
  ];
};
