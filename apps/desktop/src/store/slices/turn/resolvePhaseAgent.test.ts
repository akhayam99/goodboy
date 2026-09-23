import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  Step,
  StepId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';

const { invokeAgentInsertSpy, invokeAgentGenerationReserveSpy, invokeAgentUpdateStatusSpy } =
  vi.hoisted(() => ({
    invokeAgentInsertSpy: vi.fn(),
    invokeAgentGenerationReserveSpy: vi.fn(),
    invokeAgentUpdateStatusSpy: vi.fn(),
  }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
  invokeAgentGenerationReserve: invokeAgentGenerationReserveSpy,
  invokeAgentUpdateStatus: invokeAgentUpdateStatusSpy,
}));

import { resolvePhaseAgent } from './resolvePhaseAgent';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

const definition = {
  id: 'step-1' as StepId,
  workflowId: 'workflow-1' as WorkflowId,
  ordinal: 0,
  name: 'Implement the fix',
  role: 'implementer',
  promptPrefix: '',
} as Step;

const resolve = () =>
  resolvePhaseAgent({
    sessionId: SESSION_ID,
    definition,
    workflowRunId: RUN_ID,
    reusable: null,
    providerRunId: 'provider-run-1' as ProviderRunId,
    now: () => '2026-09-23T00:00:00.000Z' as IsoDateTime,
  });

beforeEach(() => {
  vi.clearAllMocks();
  invokeAgentInsertSpy.mockResolvedValue({ id: 'agent-1' as AgentId });
});

describe('resolvePhaseAgent', () => {
  it('spends a workflow-step reservation and binds it when it creates the agent', async () => {
    invokeAgentGenerationReserveSpy.mockResolvedValue({
      kind: 'granted',
      reservations: [{ reservationId: 'reservation:0', depth: 0, causalRootAgentId: null }],
    });

    await resolve();

    expect(invokeAgentGenerationReserveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        workflowRunId: RUN_ID,
        parentAgentId: null,
        creationPath: 'workflow-step',
        count: 1,
      }),
    );
    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ generationReservationId: 'reservation:0' }),
    );
  });

  it('creates no agent when the ledger refuses the step', async () => {
    invokeAgentGenerationReserveSpy.mockResolvedValue({
      kind: 'refused',
      limit: 'run-descendants',
      reason: 'this run already generated 32 of 32 agents',
      isFirstRefusal: true,
    });

    await expect(resolve()).rejects.toThrow('this run already generated 32 of 32 agents');
    expect(invokeAgentInsertSpy).not.toHaveBeenCalled();
  });
});
