import type { WorkflowRoutingDecision, WorkflowTaskDifficulty } from '@goodboy/types';

export const WORKFLOW_ROUTING_COPY = {
  sectionLabel: 'Model per step',
  sectionHint: 'Which model runs each step, and why it was chosen.',
  lockedLabel: 'Locked by you',
  legacyLabel: 'Existing selection',
  automaticLabel: 'Automatic',
  resetLabel: 'Use automatic selection',
  legacyResetLabel: 'Reset to automatic',
  immutableRefusal:
    'This step has already started, so its model stays as it ran. Stop the step to choose the model for the next attempt.',
  missingNode: 'This step is no longer part of the run.',
  unknownFailure: 'The model choice could not be saved.',
  noSelection: 'No model resolved yet.',
  reasonLabel: 'Why this model',
  immutableNote: 'Fixed once the step started.',
} as const;

export const WORKFLOW_ROUTING_SOURCE_LABEL = {
  step_lock: WORKFLOW_ROUTING_COPY.lockedLabel,
  run_role_lock: 'Run role lock',
  agent: 'Chosen by the orchestrator',
  heuristic: 'Chosen by fit',
  role_default: 'Role default',
  session_default: 'Session default',
  kind_default: 'Step kind default',
  legacy: WORKFLOW_ROUTING_COPY.legacyLabel,
} as const satisfies Record<WorkflowRoutingDecision['source'], string>;

export const WORKFLOW_TASK_DIFFICULTY_LABEL = {
  light: 'Light work',
  standard: 'Standard work',
  heavy: 'Heavy work',
  unknown: 'Unrated work',
} as const satisfies Record<WorkflowTaskDifficulty, string>;
