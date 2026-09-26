import type { Agent, AgentId, Skill, Workflow } from '@goodboy/types';
import type { RunnableScript, SessionScriptGroup } from '../scripts/buildSessionScripts';
import { AGENT_KIND_META, classifyAgent, type AgentKind } from '../session/agent-kind';
import type { QuickActionItem } from './types';

export type ScriptPick = {
  readonly script: RunnableScript;
  readonly group: SessionScriptGroup;
};

type ScriptActionsParams = {
  readonly groups: ReadonlyArray<SessionScriptGroup>;
  readonly runningKeys: ReadonlySet<string>;
  readonly onPick: (pick: ScriptPick) => void;
};

type MountLabelParams = {
  readonly group: SessionScriptGroup;
  readonly groups: ReadonlyArray<SessionScriptGroup>;
};

const mountLabel = ({ group, groups }: MountLabelParams): string =>
  groups.filter((candidate) => candidate.projectId === group.projectId).length > 1
    ? `${group.projectName} · ${group.branch}`
    : group.projectName;

const packageDescriptor = ({ script }: { readonly script: RunnableScript }): string => {
  if (script.source === 'saved') {
    return 'Saved';
  }
  return script.relDir === '' ? 'root' : script.packageName;
};

const shortPackageLabel = ({ script }: { readonly script: RunnableScript }): string => {
  if (script.source === 'saved') {
    return 'Saved';
  }
  if (script.relDir === '') {
    return 'root';
  }
  const segments = script.packageName.split('/');
  return segments[segments.length - 1] ?? script.packageName;
};

export const buildScriptActions = ({
  groups,
  runningKeys,
  onPick,
}: ScriptActionsParams): ReadonlyArray<QuickActionItem> => {
  const showsMount = groups.length > 1;
  return groups.flatMap((group) => {
    if (!group.isReady) {
      return [];
    }
    const mount = mountLabel({ group, groups });
    return group.scripts.map((script) => ({
      id: `script:${group.mountId}:${script.key}`,
      label: script.name,
      sublabel: showsMount
        ? `${mount} · ${packageDescriptor({ script })} · ${script.body}`
        : `${packageDescriptor({ script })} · ${script.body}`,
      trailing: {
        label: runningKeys.has(script.key) ? 'Running' : shortPackageLabel({ script }),
      },
      group: 'script',
      perform: () => onPick({ script, group }),
    }));
  });
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
      const kind = classifyAgent({ agent, override: kindOverride[agent.id] ?? null });
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
