// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { anAgent, aWorkflowRun } from '@goodboy/types/testing';
import { runOutcomeTextOf } from './runOutcomeTextOf';

describe('runOutcomeTextOf', () => {
  it('reads the run summary first', () => {
    const run = aWorkflowRun({ orchestratorSummary: ' The export is fixed. ' });

    expect(runOutcomeTextOf({ run, agents: [] })).toBe('The export is fixed.');
  });

  it('falls back on the last finished step of a preset run', () => {
    const agents = [
      anAgent({ status: 'completed', ordinal: 0, outputSummary: 'Found it.' }),
      anAgent({ status: 'completed', ordinal: 1, outputSummary: 'Fixed it.' }),
      anAgent({ status: 'skipped', ordinal: 2, outputSummary: 'Skipped it.' }),
    ];

    expect(runOutcomeTextOf({ run: aWorkflowRun(), agents })).toBe('Fixed it.');
  });

  it('is empty when no step left a summary', () => {
    expect(runOutcomeTextOf({ run: aWorkflowRun(), agents: [] })).toBe('');
  });
});
