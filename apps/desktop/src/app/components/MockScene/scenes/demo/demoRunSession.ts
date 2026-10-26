import type { Session, WorkflowRun } from '@goodboy/types';
import { AUTO_STORY, ORCHESTRATE_GOAL } from '../../demo/director/autoStory';
import { DYNAMIC_RUN_ID, FLOW_SESSION } from '../flow-audit/fixtures';
import { agoIso } from './agoIso';

const baseRun = FLOW_SESSION.workflowRuns.find((run) => run.id === DYNAMIC_RUN_ID);

if (baseRun === undefined) {
  throw new Error('the flow seed has no orchestrated run');
}

const DEMO_RUN: WorkflowRun = {
  ...baseRun,
  currentStep: 3,
  orchestratorHints: [],
  orchestrationOutcome: 'done',
  orchestratorSummary: AUTO_STORY.final,
  goal: ORCHESTRATE_GOAL,
};

export const DEMO_RUN_SESSION: Session = {
  ...FLOW_SESSION,
  goal: ORCHESTRATE_GOAL,
  state: { kind: 'idle', lastActivityAt: agoIso({ minutes: 18 }) },
  workflowRuns: [DEMO_RUN],
};
