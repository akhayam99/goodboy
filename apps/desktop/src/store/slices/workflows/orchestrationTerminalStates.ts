import type { WorkflowRunId } from '@goodboy/types';

export const orchestrationTerminalStates = new Map<WorkflowRunId, 'done' | 'blocked'>();
