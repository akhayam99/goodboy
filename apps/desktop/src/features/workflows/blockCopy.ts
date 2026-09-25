import type { WorkflowBlockReason } from './advanceGate';

export const WORKFLOW_BLOCK_COPY: Record<WorkflowBlockReason, string> = {
  questions: 'Open questions are waiting for an answer.',
  summarizer: 'The step summary is still being written.',
  'failed-step': 'The current step failed.',
  'stopped-step': 'You stopped the current step. Autorun does not pass a stopped step.',
  'turn-running': 'This step is still working.',
};
