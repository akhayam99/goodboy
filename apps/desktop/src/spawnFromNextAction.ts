import type { NextAction } from '@kay-am/core';
import type { TaskId } from '@kay-am/types';
import { AGENT_KIND_DEFAULTS, type AgentKind } from './agentKind';

export type SpawnAgentFn = (
  taskId: TaskId,
  args: { name?: string; model?: string; effort?: 'low' | 'medium' | 'high' },
) => Promise<unknown>;

export function spawnKindForAction(action: NextAction): AgentKind | null {
  switch (action.id) {
    case 'spawn_planner':
      return 'planner';
    case 'spawn_implementer':
      return 'implementer';
    case 'spawn_debugger':
      return 'debugger';
    default:
      return null;
  }
}

export async function spawnFromNextAction(
  action: NextAction,
  taskId: TaskId,
  spawnAgent: SpawnAgentFn,
): Promise<boolean> {
  const kind = spawnKindForAction(action);
  if (!kind) return false;
  const defaults = AGENT_KIND_DEFAULTS[kind];
  await spawnAgent(taskId, {
    name: action.label,
    model: defaults.model,
    effort: defaults.effort,
  });
  return true;
}
