import { describe, expect, it } from 'vitest';
import type { AgentId, WorkflowRunId } from '@goodboy/types';
import { countLiveWork } from './index';

const liveWork = (partial: Partial<Parameters<typeof countLiveWork>[0]['liveWork']>) => ({
  runningAgentIds: [],
  blockedAgentIds: [],
  decidingRunIds: [],
  decidingRuns: [],
  liveSessionIds: [],
  ...partial,
});

describe('countLiveWork', () => {
  it('counts running, blocked and deciding work together', () => {
    expect(
      countLiveWork({
        liveWork: liveWork({
          runningAgentIds: ['a' as AgentId, 'b' as AgentId],
          blockedAgentIds: ['c' as AgentId],
          decidingRunIds: ['w' as WorkflowRunId],
        }),
      }),
    ).toBe(4);
  });

  it('is zero when nothing runs', () => {
    expect(countLiveWork({ liveWork: liveWork({}) })).toBe(0);
  });
});
