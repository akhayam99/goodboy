import type { Agent, Workflow } from '@goodboy/types';
import { WORKFLOW_LIBRARY } from '@goodboy/core';

export const FOOTER_ICON_BTN =
  'flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50' as const;

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

export type WorkflowBlockReason = 'questions' | 'summarizer';

export type ResolverState = 'awaiting' | 'committed' | 'wontfix';
export type ResolverStatus =
  | 'running'
  | 'failed'
  | 'pending'
  | 'resolved'
  | 'committed'
  | 'wontfix'
  | 'awaiting'
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
  if (state === 'wontfix') {
    return 'wontfix';
  }
  if (state === 'awaiting') {
    return 'awaiting';
  }
  return 'done';
}
