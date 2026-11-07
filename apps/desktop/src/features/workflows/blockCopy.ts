import type { WorkflowBlockReason } from './advanceGate';

export const WORKFLOW_BLOCK_COPY: Record<WorkflowBlockReason, string> = {
  questions: 'Open questions are waiting for an answer.',
  summarizer: 'The step summary is still being written.',
  'failed-step': 'The current step failed or needs you.',
  'stopped-step': 'You stopped the current step. The run does not pass a stopped step.',
  'turn-running': 'This step is still running.',
  paused: 'The run is paused. Continue it to start the next step.',
  'plan-approval': 'The plan is ready. Approve it to start the rest of the run.',
};
