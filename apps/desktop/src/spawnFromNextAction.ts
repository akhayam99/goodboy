import type { NextAction } from '@kay-am/core';
import type { TaskId } from '@kay-am/types';
import { AGENT_KIND_DEFAULTS, type AgentKind } from './agentKind';

export type SpawnAgentFn = (
  taskId: TaskId,
  args: {
    name?: string;
    model?: string;
    effort?: 'low' | 'medium' | 'high';
    initialPrompt?: string;
  },
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

function kickoffPromptFor(action: NextAction): string {
  switch (action.id) {
    case 'spawn_planner':
      return 'plan the next steps based on the current context.';
    case 'spawn_implementer':
      return 'implement based on the latest plan.';
    case 'spawn_debugger': {
      const topic = action.payload?.topic?.trim();
      return topic ? `debug ${topic}.` : 'debug the current failure.';
    }
    default:
      return '';
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
  const initialPrompt = kickoffPromptFor(action);
  await spawnAgent(taskId, {
    name: action.label,
    model: defaults.model,
    effort: defaults.effort,
    ...(initialPrompt ? { initialPrompt } : {}),
  });
  return true;
}
