import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type WorkflowOrchestrationStop,
  type WorkflowRunId,
} from '@goodboy/types';
import { heldAnswerCountOf } from './heldAnswerCount';

const RUN_ID = brandId<WorkflowRunId>({ value: 'run-harborline' });
const OTHER_ID = brandId<WorkflowRunId>({ value: 'run-northwind' });
const DELIVERED_AT = brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' });

type StopParams = {
  readonly kind: WorkflowOrchestrationStop['kind'];
};

const stop = ({ kind }: StopParams): WorkflowOrchestrationStop => ({ kind, message: 'stopped' });

const held = { workflowRunId: RUN_ID, answerDeliveredAt: undefined, userAnswer: 'Batch them' };

describe('heldAnswerCountOf', () => {
  it('counts the answered and undelivered questions of the stopped run', () => {
    expect(
      heldAnswerCountOf({
        run: { id: RUN_ID, orchestrationStop: stop({ kind: 'budget' }) },
        answered: [held, { ...held, userAnswer: '500 rows' }],
      }),
    ).toBe(2);
  });

  it('leaves out delivered answers, other runs and questions with no answer', () => {
    expect(
      heldAnswerCountOf({
        run: { id: RUN_ID, orchestrationStop: stop({ kind: 'paused' }) },
        answered: [
          held,
          { ...held, answerDeliveredAt: DELIVERED_AT },
          { ...held, workflowRunId: OTHER_ID },
          { ...held, userAnswer: null },
        ],
      }),
    ).toBe(1);
  });

  it.each(['questions', 'closed'] as const)('counts nothing on a %s stop', (kind) => {
    expect(
      heldAnswerCountOf({
        run: { id: RUN_ID, orchestrationStop: stop({ kind }) },
        answered: [held],
      }),
    ).toBe(0);
  });

  it('counts nothing on a run that is not stopped', () => {
    expect(heldAnswerCountOf({ run: { id: RUN_ID }, answered: [held] })).toBe(0);
  });
});
