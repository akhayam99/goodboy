import { describe, expect, it } from 'vitest';
import type { AgentId, ProviderRunId } from '@goodboy/types';
import { seedRunRoutingFromSpans } from './seedRunRoutingFromSpans';

const AGENT = 'agent-1' as AgentId;
const RUN = 'run-1' as ProviderRunId;

describe('seedRunRoutingFromSpans', () => {
  it('restores what a finished run was started with after a reload', () => {
    expect(
      seedRunRoutingFromSpans({
        runRouting: {},
        routes: [
          {
            runId: RUN,
            agentId: AGENT,
            provider: 'anthropic',
            model: 'claude-opus-5-5',
            effort: 'medium',
          },
        ],
      }),
    ).toEqual({
      [AGENT]: { [RUN]: { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'medium' } },
    });
  });

  it('keeps the routing a live turn already wrote for the same run', () => {
    const runRouting = {
      [AGENT]: { [RUN]: { provider: 'codex' as const, model: 'gpt-6-astra', effort: 'high' } },
    };

    expect(
      seedRunRoutingFromSpans({
        runRouting,
        routes: [
          {
            runId: RUN,
            agentId: AGENT,
            provider: 'anthropic',
            model: 'claude-opus-5-5',
            effort: 'low',
          },
        ],
      }),
    ).toEqual(runRouting);
  });

  it('hands back the same state when the session has no spans', () => {
    const runRouting = {};

    expect(seedRunRoutingFromSpans({ runRouting, routes: [] })).toBe(runRouting);
  });
});
