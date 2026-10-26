import type { Session, WorkflowRun } from '@goodboy/types';
import { AUTO_STORY } from '../../demo/director/autoStory';
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
};

export const DEMO_RUN_SESSION: Session = {
  ...FLOW_SESSION,
  state: { kind: 'idle', lastActivityAt: agoIso({ minutes: 18 }) },
  workflowRuns: [DEMO_RUN],
};
