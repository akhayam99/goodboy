import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { activeAskBackend, registerAskBackend } from './activeAskBackend';
import { createMemoryAskBackend } from '../../../test/createMemoryAskBackend';
import { mockAskResponder } from '../../../app/components/MockScene/backends/ask/mockAskResponder';
import { tauriAskBackend } from './tauriAskBackend';

const sessionId = brandId<SessionId>({ value: 'session-harborline' });

describe('the active ask backend', () => {
  afterEach(() => {
    registerAskBackend({ backend: tauriAskBackend });
  });

  it('answers through the backend that was registered last', async () => {
    const listThreads = vi.fn(async () => []);
    registerAskBackend({
      backend: { ...createMemoryAskBackend({ respond: mockAskResponder }), listThreads },
    });

    await activeAskBackend.listThreads({ sessionId });

    expect(listThreads).toHaveBeenCalledWith({ sessionId });
  });

  it('switches to a later registration without a new import', async () => {
    const first = vi.fn(async () => []);
    const second = vi.fn(async () => []);
    const base = createMemoryAskBackend({ respond: mockAskResponder });
    registerAskBackend({ backend: { ...base, listThreads: first } });
    registerAskBackend({ backend: { ...base, listThreads: second } });

    await activeAskBackend.listThreads({ sessionId });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
