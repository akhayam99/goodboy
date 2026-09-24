import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  release: vi.fn(),
  list: vi.fn(),
}));

vi.mock('../../../features/worktree/writerLease', () => ({
  releaseUnknownWriterLease: h.release,
  listUnknownWriterLeases: h.list,
}));

import { releaseStrandedWriterLease } from './releaseStrandedWriterLease';

const createHarness = () => {
  const emitNotification = vi.fn(async () => undefined);
  const state = { strandedWriterLeases: [], emitNotification };
  const set = ((update: unknown) => {
    if (typeof update === 'function') {
      Object.assign(state, (update as (current: typeof state) => Partial<typeof state>)(state));
      return;
    }
    Object.assign(state, update);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get, emitNotification };
};

describe('releaseStrandedWriterLease', () => {
  beforeEach(() => {
    h.release.mockReset();
    h.list.mockReset();
    h.list.mockImplementation(async () => []);
  });

  it('clears a stranded lease and records who cleared it and why', async () => {
    const { set, get, emitNotification } = createHarness();
    h.release.mockImplementation(async () => ({
      kind: 'released',
      id: 'lease-1',
      holder: 'agent-1',
    }));

    const outcome = await releaseStrandedWriterLease({ set, get })({
      leaseId: 'lease-1',
      releasedBy: 'the user',
      releaseEvidence: 'confirmed the holder is gone',
    });

    expect(outcome).toEqual({ kind: 'released', id: 'lease-1', holder: 'agent-1' });
    expect(h.release).toHaveBeenCalledWith({
      leaseId: 'lease-1',
      releasedBy: 'the user',
      evidence: 'confirmed the holder is gone',
    });
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'info',
        title: 'Writer lease released',
        body: expect.stringContaining('confirmed the holder is gone'),
      }),
    );
  });

  it('says why a lease whose owner is alive was not cleared', async () => {
    const { set, get, emitNotification } = createHarness();
    h.release.mockImplementation(async () => ({
      kind: 'owner-alive',
      id: 'lease-1',
      processId: 4211,
    }));

    const outcome = await releaseStrandedWriterLease({ set, get })({
      leaseId: 'lease-1',
      releasedBy: 'the user',
      releaseEvidence: 'looks stuck',
    });

    expect(outcome.kind).toBe('owner-alive');
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: 'Writer lease not released',
        body: expect.stringContaining('4211'),
      }),
    );
  });

  it('refuses a release that names no evidence before it reaches the host', async () => {
    const { set, get } = createHarness();

    const outcome = await releaseStrandedWriterLease({ set, get })({
      leaseId: 'lease-1',
      releasedBy: 'the user',
      releaseEvidence: '   ',
    });

    expect(outcome).toEqual({ kind: 'evidence-missing', id: 'lease-1' });
    expect(h.release).not.toHaveBeenCalled();
  });
});
