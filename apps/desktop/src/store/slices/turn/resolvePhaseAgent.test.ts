const { invokeAgentInsertSpy, invokeAgentUpdateStatusSpy } = vi.hoisted(() => ({
  invokeAgentInsertSpy: vi.fn(),
  invokeAgentUpdateStatusSpy: vi.fn(),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
  invokeAgentUpdateStatus: invokeAgentUpdateStatusSpy,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type ProviderRunId,
  type SessionId,
  type Step,
  type StepId,
  type WorkflowId,
  type WorkflowRunId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { resolvePhaseAgent } from './resolvePhaseAgent';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger-core' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-ledger-core' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-refactor' });
const PROVIDER_RUN_ID = brandId<ProviderRunId>({ value: 'provider-run-1' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-29T00:00:00.000Z' });

const DEFINITION: Step = {
  id: brandId<StepId>({ value: 'step-1' }),
  workflowId: brandId<WorkflowId>({ value: 'workflow-1' }),
  ordinal: 1,
  name: 'Implement the fix',
  role: 'implementer',
  promptPrefix: 'Do it.',
};

const resolve = ({
  mountId,
  isReusable,
}: {
  readonly mountId: MountId | null;
  readonly isReusable: boolean;
}) =>
  resolvePhaseAgent({
    sessionId: SESSION_ID,
    definition: DEFINITION,
    workflowRunId: RUN_ID,
    mountId,
    reusable: isReusable ? anAgent({ sessionId: SESSION_ID }) : null,
    providerRunId: PROVIDER_RUN_ID,
    now: () => NOW,
  });

beforeEach(() => {
  vi.clearAllMocks();
  invokeAgentInsertSpy.mockResolvedValue(anAgent());
  invokeAgentUpdateStatusSpy.mockResolvedValue(anAgent());
});

describe('resolvePhaseAgent', () => {
  it('pins the mount of the turn on a reused step agent', async () => {
    await resolve({ mountId: MOUNT_ID, isReusable: true });

    expect(invokeAgentUpdateStatusSpy.mock.calls[0]![1]).toMatchObject({ mountId: MOUNT_ID });
  });

  it('pins the mount of the turn on a step agent it creates', async () => {
    await resolve({ mountId: MOUNT_ID, isReusable: false });

    expect(invokeAgentInsertSpy.mock.calls[0]![0]).toMatchObject({ mountId: MOUNT_ID });
  });

  it('writes no mount when the turn ran in none', async () => {
    await resolve({ mountId: null, isReusable: true });
    await resolve({ mountId: null, isReusable: false });

    expect(invokeAgentUpdateStatusSpy.mock.calls[0]![1]).not.toHaveProperty('mountId');
    expect(invokeAgentInsertSpy.mock.calls[0]![0]).not.toHaveProperty('mountId');
  });
});
