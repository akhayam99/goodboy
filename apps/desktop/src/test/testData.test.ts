// @vitest-environment node
import {
  aProject,
  aSession,
  aWorkflowRun,
  aWorkspace,
  anAgent,
  EMPTY_OVERRIDES,
} from '@goodboy/types/testing';
import { describe, expect, it } from 'vitest';

describe('test data builders', () => {
  it('gives every call of a builder its own id', () => {
    const ids = [aSession(), aSession()].map((session) => session.id);
    const agentIds = [anAgent(), anAgent()].map((agent) => agent.id);

    expect(new Set(ids).size).toBe(2);
    expect(new Set(agentIds).size).toBe(2);
  });

  it('lets an override win and keeps the other defaults', () => {
    const session = aSession({ goal: 'Close the Northwind books', autoRun: true });

    expect(session.goal).toBe('Close the Northwind books');
    expect(session.autoRun).toBe(true);
    expect(session.state).toEqual({ kind: 'draft' });
    expect(session.contextSlots).toEqual([]);
    expect(session.workflowRuns).toEqual([]);
  });

  it('fills every field a consumer reads, never leaving one undefined', () => {
    const complete = [aSession(), anAgent(), aProject(), aWorkspace(), aWorkflowRun()];

    const undefinedKeys = complete.flatMap((data) =>
      Object.entries(data)
        .filter(([, value]) => value === undefined)
        .map(([key]) => key),
    );

    expect(undefinedKeys).toEqual([]);
    expect(aProject().overrides).toBe(EMPTY_OVERRIDES);
    expect(aWorkspace().overrides).toBe(EMPTY_OVERRIDES);
  });

  it('names its data with the mock vocabulary', () => {
    expect(aWorkspace().name).toBe('Harborline');
    expect(aProject().name).toBe('ledger-core');
    expect(aSession().goal).toContain('Harborline');
  });
});
