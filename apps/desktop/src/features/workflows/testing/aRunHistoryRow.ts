import type { WorkflowRunHistoryRow } from '@goodboy/db';
import {
  brandId,
  type IsoDateTime,
  type SessionId,
  type WorkflowId,
  type WorkflowRunId,
} from '@goodboy/types';

type Params = {
  readonly id?: string;
  readonly workflowId?: string;
  readonly sessionGoal?: string;
  readonly createdAt?: string;
  readonly overrides?: Partial<
    Omit<WorkflowRunHistoryRow, 'workflowRunId' | 'workflowId' | 'sessionId' | 'createdAt'>
  >;
};

export const aRunHistoryRow = ({
  id = 'run-1',
  workflowId = 'wf-flaky',
  sessionGoal = 'Ledger export speed up',
  createdAt = '2026-10-15T15:08:00.000Z',
  overrides = {},
}: Params = {}): WorkflowRunHistoryRow => ({
  workflowRunId: brandId<WorkflowRunId>({ value: id }),
  workflowId: brandId<WorkflowId>({ value: workflowId }),
  sessionId: brandId<SessionId>({ value: `ses-${id}` }),
  sessionGoal,
  isSessionArchived: false,
  executionMode: 'static',
  orchestrationOutcome: null,
  createdAt: brandId<IsoDateTime>({ value: createdAt }),
  stepCount: 3,
  startedSteps: 0,
  finishedSteps: 0,
  runningSteps: 0,
  failedSteps: 0,
  stoppedSteps: 0,
  costUsd: 0,
  ...overrides,
});
