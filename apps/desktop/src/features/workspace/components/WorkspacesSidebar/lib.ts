import type { Agent, Workflow } from '@goodboy/types';
import { WORKFLOW_LIBRARY } from '@goodboy/core';

export function workflowKindName(workflow: Workflow): string {
  const raw = workflow.name.trim();
  if (!raw) {
    return 'custom';
  }
  const match = WORKFLOW_LIBRARY.find((entry) => entry.name.toLowerCase() === raw.toLowerCase());
  return match ? match.name.toLowerCase() : raw;
}

export const pluralize = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? '' : 's'}`;

export type WorkflowBlockReason = 'questions' | 'summarizer' | 'failed-step';

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

export function resolverStatus(
  agent: Agent,
  resolvedThreadIds: ReadonlySet<string>,
  pendingThreadIds: ReadonlySet<string>,
  state: ResolverState | undefined,
): ResolverStatus {
  if (agent.status === 'running') {
    return 'running';
  }
  if (agent.status === 'failed') {
    return 'failed';
  }
  if (agent.status === 'pending') {
    return 'pending';
  }
  const tid = agent.sourceThreadId;
  if (tid != null && resolvedThreadIds.has(tid)) {
    return 'resolved';
  }
  if (state === 'committed' || (tid != null && pendingThreadIds.has(tid))) {
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
}
