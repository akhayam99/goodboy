import type { NextAction } from '@kay-am/core';
import type { TaskId } from '@kay-am/types';
import { AGENT_KIND_DEFAULTS, type AgentKind } from './agent-kind';

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
    case 'spawn_scout':
      return 'scout';
    case 'spawn_planner':
      return 'planner';
    case 'spawn_implementer':
      return 'implementer';
    case 'spawn_debugger':
      return 'debugger';
    case 'spawn_reviewer':
      return 'reviewer';
    case 'spawn_tester':
      return 'reviewer';
    case 'spawn_docs':
      return 'docs';
    default:
      return null;
  }
}

function kickoffPromptFor(action: NextAction): string {
  switch (action.id) {
    case 'spawn_scout':
      return 'explore the current scope and surface what is still unclear before planning.';
    case 'spawn_planner':
      return 'plan the next steps based on the current context.';
    case 'spawn_implementer':
      return 'implement based on the latest plan.';
    case 'spawn_debugger': {
      const topic = action.payload?.topic?.trim();
      return topic ? `debug ${topic}.` : 'debug the current failure.';
    }
    case 'spawn_reviewer':
      return 'review the latest changes for correctness, style, and edge cases.';
    case 'spawn_tester':
      return 'write tests covering the latest changes. include unit and edge cases.';
    case 'spawn_docs':
      return 'document the latest changes. update relevant readme or guides.';
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
