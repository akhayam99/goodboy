import type { Agent, Workflow } from '@goodboy/types';
import { WORKFLOW_LIBRARY } from '@goodboy/core';
import { agentThreadIds } from '../../../session/agentThreadIds';

export const workflowKindName = (workflow: Workflow): string => {
  const raw = workflow.name.trim();
  if (!raw) {
    return 'custom';
  }
  const match = WORKFLOW_LIBRARY.find((entry) => entry.name.toLowerCase() === raw.toLowerCase());
  return match ? match.name.toLowerCase() : raw;
};

export const pluralize = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? '' : 's'}`;

export type ResolverState = 'awaiting' | 'committed' | 'wontfix' | 'analyzed' | 'stopped';
export type ResolverStatus =
  | 'running'
  | 'failed'
  | 'pending'
  | 'resolved'
  | 'committed'
  | 'analyzed'
  | 'wontfix'
  | 'awaiting'
  | 'stopped'
  | 'done';

export const resolverStatus = (
  agent: Agent,
  resolvedThreadIds: ReadonlySet<string>,
  pendingThreadIds: ReadonlySet<string>,
  state: ResolverState | undefined,
): ResolverStatus => {
  if (agent.status === 'running') {
    return 'running';
  }
  if (agent.status === 'failed') {
    return 'failed';
  }
  if (agent.status === 'pending') {
    return 'pending';
  }
  const threadIds = agentThreadIds(agent);
  if (threadIds.length > 0 && threadIds.every((threadId) => resolvedThreadIds.has(threadId))) {
    return 'resolved';
  }
  if (state === 'committed' || threadIds.some((threadId) => pendingThreadIds.has(threadId))) {
    return 'committed';
  }
  if (state === 'stopped') {
    return 'stopped';
  }
  if (state === 'analyzed') {
    return 'analyzed';
  }
  if (state === 'wontfix') {
    return 'wontfix';
  }
  if (state === 'awaiting') {
    return 'awaiting';
  }
  return 'done';
};
