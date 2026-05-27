import type { Agent, Skill, Workflow, WorkspaceScript } from '@goodboy/types';
import { AGENT_KIND_META, inferAgentKindFromName } from '../session/agent-kind';
import type { QuickActionItem } from './types';

function firstLine(body: string): string | undefined {
  const line = body.trim().split('\n', 1)[0]?.trim();
  return line ? line : undefined;
}

/** Maps workspace scripts to quick-action rows. `onPick` owns the run. */
export function buildScriptActions(
  scripts: ReadonlyArray<WorkspaceScript>,
  onPick: (script: WorkspaceScript) => void,
): ReadonlyArray<QuickActionItem> {
  return scripts.map((script) => ({
    id: `script:${script.id}`,
    label: script.name,
    sublabel: firstLine(script.body),
    group: 'script',
    perform: () => onPick(script),
  }));
}

/** Maps workspace skills to quick-action rows. `onPick` pre-fills the input. */
export function buildSkillActions(
  skills: ReadonlyArray<Skill>,
  onPick: (skill: Skill) => void,
): ReadonlyArray<QuickActionItem> {
  return skills.map((skill) => ({
    id: `skill:${skill.id}`,
    label: skill.name,
    sublabel: skill.description || undefined,
    group: 'skill',
    perform: () => onPick(skill),
  }));
}

/** Maps workspace workflows to quick-action rows. `onPick` starts the workflow. */
export function buildWorkflowActions(
  workflows: ReadonlyArray<Workflow>,
  onPick: (workflow: Workflow) => void,
): ReadonlyArray<QuickActionItem> {
  return workflows.map((workflow) => ({
    id: `workflow:${workflow.id}`,
    label: workflow.name,
    sublabel:
      workflow.description ||
      `${workflow.steps.length} step${workflow.steps.length === 1 ? '' : 's'}`,
    group: 'workflow',
    perform: () => onPick(workflow),
  }));
}

/**
 * Maps session agents to switch rows, plus a trailing "spawn new agent" row.
 * `onSwitch` navigates to an existing agent; `onSpawn` creates a fresh one.
 */
export function buildAgentActions(
  agents: ReadonlyArray<Agent>,
  onSwitch: (agent: Agent) => void,
  onSpawn: () => void,
): ReadonlyArray<QuickActionItem> {
  const switches = agents
    .filter((agent) => agent.deletedAt === undefined)
    .map<QuickActionItem>((agent) => {
      const kind = inferAgentKindFromName(agent.name);
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
    { id: 'agent:spawn', label: '+ create new agent', group: 'agent', perform: onSpawn },
  ];
}
