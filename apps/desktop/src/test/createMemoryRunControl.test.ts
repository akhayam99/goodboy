import { describe, expect, it } from 'vitest';
import { brandId, type ProviderRunId } from '@goodboy/types';
import { createMemoryRunControl } from './createMemoryRunControl';

const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const OTHER = brandId<ProviderRunId>({ value: 'run-2' });

describe('createMemoryRunControl', () => {
  it('hands the responder an isCancelled that flips when its run is cancelled', async () => {
    const control = createMemoryRunControl();
    const seen: boolean[] = [];

    const outcome = await control.start({
      params: { request: { runId: RUN } },
      respond: async ({ isCancelled }) => {
        seen.push(isCancelled());
        await control.cancel({ runId: RUN });
        seen.push(isCancelled());
        return { status: 'done' };
      },
    });

    expect(outcome).toEqual({ status: 'done' });
    expect(seen).toEqual([false, true]);
  });

  it('leaves another run alone', async () => {
    const control = createMemoryRunControl();
    await control.cancel({ runId: OTHER });

    const seen = await control.start({
      params: { request: { runId: RUN } },
      respond: async ({ isCancelled }) => ({
        status: isCancelled() ? 'failed' : 'done',
        error: 'cancelled',
      }),
    });

    expect(seen.status).toBe('done');
  });

  it('forgets a cancel once its run has ended', async () => {
    const control = createMemoryRunControl();
    await control.start({
      params: { request: { runId: RUN } },
      respond: async () => {
        await control.cancel({ runId: RUN });
        return { status: 'done' };
      },
    });

    const second = await control.start({
      params: { request: { runId: RUN } },
      respond: async ({ isCancelled }) =>
        isCancelled() ? { status: 'failed', error: 'stale cancel' } : { status: 'done' },
    });

    expect(second).toEqual({ status: 'done' });
  });
});
