import type { WorkflowAutonomy } from '@goodboy/types';
import { NAMES } from '../../shared/utils/names';
import { runAutonomyOf } from './runAutonomy';

type SplitParams = {
  readonly workflow: WorkflowAutonomy;
  readonly lead: WorkflowAutonomy;
};

export const STOPS_LEVEL_COPY = {
  label: 'Stops for your OK',
  help: `When a new workflow or ${NAMES.lead} run waits for your go.`,
  shared: `Workflows and the ${NAMES.lead} follow it.`,
  split: ({ workflow, lead }: SplitParams): string =>
    `Workflows: ${runAutonomyOf({ autoRun: false, autonomy: workflow }).label} · ${NAMES.lead}: ${runAutonomyOf({ autoRun: false, autonomy: lead }).label}. Pick one.`,
} as const;
