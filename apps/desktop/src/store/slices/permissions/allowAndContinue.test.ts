import { describe, expect, it, vi } from 'vitest';
import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { allowAndContinue } from './allowAndContinue';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;

type Harness = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly appendTurnEvent: ReturnType<typeof vi.fn>;
  readonly sendTurn: ReturnType<typeof vi.fn>;
  readonly state: { volatilePermissionAllows: ReadonlySet<string> };
};

const createHarness = (): Harness => {
  const state = { volatilePermissionAllows: new Set<string>() };
  const appendTurnEvent = vi.fn();
  const sendTurn = vi.fn(async () => undefined);
  const set = ((update: unknown) => {
    if (typeof update === 'function') {
      Object.assign(state, (update as (s: typeof state) => Partial<typeof state>)(state));
      return;
    }
    Object.assign(state, update);
  }) as SetFn;
  const get = (() => ({ ...state, appendTurnEvent, sendTurn })) as unknown as GetFn;
  return { set, get, appendTurnEvent, sendTurn, state };
};

describe('allowAndContinue', () => {
  it('grants exactly the requested call and resumes the turn with the exact-command pattern', async () => {
    const { set, get, sendTurn } = createHarness();

    await allowAndContinue(
      set,
      get,
    )({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: 'tu-1',
      toolName: 'Bash',
      input: { command: 'pnpm test --filter ledger-core' },
      runId: RUN_ID,
    });

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        permissionOnceAllow: 'Bash(pnpm test --filter ledger-core)',
      }),
    );
  });

  it('appends a permission_decision(once) event before resuming', async () => {
    const { set, get, appendTurnEvent } = createHarness();

    await allowAndContinue(
      set,
      get,
    )({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: 'tu-2',
      toolName: 'Edit',
      input: { file_path: '/repo/src/refund.ts' },
      runId: RUN_ID,
    });

    expect(appendTurnEvent).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({
        kind: 'permission_decision',
        toolUseId: 'tu-2',
        decision: 'allow',
        scope: 'once',
      } satisfies Partial<Extract<TurnEvent, { kind: 'permission_decision' }>>),
    );
  });
});
