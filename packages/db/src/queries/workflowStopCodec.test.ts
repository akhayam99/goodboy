import { describe, expect, it } from 'vitest';
import type { WorkflowOrchestrationStop } from '@goodboy/types';
import { stopKindColumnOf, withAutoRunFlag } from './workflowStopCodec';

const OPERATOR: WorkflowOrchestrationStop = { kind: 'operator', message: 'You stopped this run.' };

describe('workflow stop columns', () => {
  it('stores a stop that turned auto run off under a kind of its own', () => {
    expect(stopKindColumnOf({ stop: { ...OPERATOR, wasAutoRun: true } })).toBe('operator:auto-run');
  });

  it('keeps a plain operator stop plain, so a saved row reads as before', () => {
    expect(stopKindColumnOf({ stop: OPERATOR })).toBe('operator');
    expect(withAutoRunFlag({ stop: OPERATOR })).toEqual(OPERATOR);
  });

  it('writes the column default for no stop', () => {
    expect(stopKindColumnOf({ stop: null })).toBe('failure');
  });
});
