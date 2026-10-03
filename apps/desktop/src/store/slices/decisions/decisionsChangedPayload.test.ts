// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import { decisionsChangedPayload } from './decisionsChangedPayload';

const ADDED = { kind: 'added', number: 3, text: 'Dedupe on the event id' } as const;

describe('decisionsChangedPayload', () => {
  it('names the agent whose turn changed the context', () => {
    expect(
      decisionsChangedPayload({ changes: [ADDED], agentId: 'agent-plan' as AgentId })?.agentId,
    ).toBe('agent-plan');
  });

  it('leaves the agent out of a change nobody owns', () => {
    expect(decisionsChangedPayload({ changes: [ADDED] })).not.toHaveProperty('agentId');
  });
});
