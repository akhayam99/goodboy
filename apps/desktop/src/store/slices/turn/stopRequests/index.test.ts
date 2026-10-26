// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type ProviderRunId } from '@goodboy/types';
import { stopRequests } from './index';

const AGENT_ID = brandId<AgentId>({ value: 'agent-harborline' });
const OTHER_AGENT_ID = brandId<AgentId>({ value: 'agent-northwind' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });
const NEXT_RUN_ID = brandId<ProviderRunId>({ value: 'run-2' });

afterEach(() => {
  stopRequests.settle({ agentId: AGENT_ID });
  stopRequests.settle({ agentId: OTHER_AGENT_ID });
});

describe('stopRequests', () => {
  it('keeps one request per agent and answers null for an agent never asked', () => {
    stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: 10 });

    expect(stopRequests.of({ agentId: AGENT_ID })).toEqual({ runId: RUN_ID, at: 10 });
    expect(stopRequests.of({ agentId: OTHER_AGENT_ID })).toBeNull();
  });

  it('replaces the request when a second stop names a newer run', () => {
    stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: 10 });
    stopRequests.request({ agentId: AGENT_ID, runId: NEXT_RUN_ID, at: 20 });

    expect(stopRequests.of({ agentId: AGENT_ID })).toEqual({ runId: NEXT_RUN_ID, at: 20 });
  });

  it('tells a listener on every request and on a settle that removes one', () => {
    const listener = vi.fn();
    const unsubscribe = stopRequests.subscribe({ listener });

    stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: 10 });
    stopRequests.settle({ agentId: AGENT_ID });
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(stopRequests.of({ agentId: AGENT_ID })).toBeNull();
  });

  it('stays silent when a settle has nothing to remove', () => {
    const listener = vi.fn();
    const unsubscribe = stopRequests.subscribe({ listener });

    stopRequests.settle({ agentId: AGENT_ID });
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops telling a listener after it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = stopRequests.subscribe({ listener });
    unsubscribe();

    stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: 10 });

    expect(listener).not.toHaveBeenCalled();
  });
});
