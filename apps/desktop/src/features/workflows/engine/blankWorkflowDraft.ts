import type { WorkflowDraft } from './types';

export const blankWorkflowDraft = (): WorkflowDraft => ({
  name: '',
  description: '',
  goal: '',
  processText: '',
  entryCheck: '',
  stopRule: '',
  thenSuggestId: null,
  isOrderKept: false,
  steps: [],
  origin: 'custom',
  isPreset: true,
});
