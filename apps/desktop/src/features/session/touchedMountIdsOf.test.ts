// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type MeasuredTurnSpan, type MountId } from '@goodboy/types';
import { NO_TOUCHED_MOUNT_IDS, touchedMountIdsOf } from './touchedMountIdsOf';

const AGENT = brandId<AgentId>({ value: 'agent-harborline' });
const API = brandId<MountId>({ value: 'mount-payments-api' });
const LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });

type SpanParams = {
  readonly touched: ReadonlyArray<MountId> | null;
};

const spanOf = ({ touched }: SpanParams): MeasuredTurnSpan => ({
  agentId: AGENT,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  startedAtMs: 0,
  endedAtMs: 1000,
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: touched,
});

describe('touchedMountIdsOf', () => {
  it('joins the worktrees of every turn of an agent without repeating one', () => {
    const touched = touchedMountIdsOf({
      spans: [spanOf({ touched: [API] }), spanOf({ touched: [API, LEDGER] })],
    });

    expect(touched.get(AGENT)).toEqual([API, LEDGER]);
  });

  it('keeps no entry for a turn that touched nothing or was never measured', () => {
    expect(touchedMountIdsOf({ spans: [spanOf({ touched: [] }), spanOf({ touched: null })] })).toBe(
      NO_TOUCHED_MOUNT_IDS,
    );
    expect(touchedMountIdsOf({ spans: undefined })).toBe(NO_TOUCHED_MOUNT_IDS);
  });
});
