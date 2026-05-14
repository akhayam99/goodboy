import type { NextAction, NextActionKind } from '@kay-am/core';
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

const NEXT_KIND_TO_AGENT_KIND: Record<NextActionKind, AgentKind> = {
  scout: 'scout',
  plan: 'planner',
  implement: 'implementer',
};

export function spawnKindForAction(action: NextAction): AgentKind {
  return NEXT_KIND_TO_AGENT_KIND[action.kind];
}

export async function spawnFromNextAction(
  action: NextAction,
  taskId: TaskId,
  spawnAgent: SpawnAgentFn,
): Promise<boolean> {
  const kind = spawnKindForAction(action);
  const defaults = AGENT_KIND_DEFAULTS[kind];
  await spawnAgent(taskId, {
    name: action.label,
    model: defaults.model,
    effort: defaults.effort,
    initialPrompt: action.prompt,
  });
  return true;
}
