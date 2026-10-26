// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: { payload: unknown }) => void;

const { listenMock, handlers } = vi.hoisted(() => ({
  listenMock: vi.fn(),
  handlers: new Map<string, Handler>(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

import { lifecycleOutputBuffer } from './lifecycleOutputBuffer';
import { listenLifecycleExit, listenLifecycleOutput } from './provider-lifecycle';

const RUN_ID = 'run-harborline';

listenMock.mockImplementation(async (name: string, handler: Handler) => {
  handlers.set(name, handler);
  return () => undefined;
});

afterEach(() => {
  lifecycleOutputBuffer.release({ runId: RUN_ID });
});

describe('the provider lifecycle stream', () => {
  it('listens once for output and once for exit, whoever is reading it', async () => {
    const onOutput = vi.fn();
    const onExit = vi.fn();
    const onPanelExit = vi.fn();

    await listenLifecycleOutput(onOutput);
    await listenLifecycleExit(onExit);
    await lifecycleOutputBuffer.register();
    lifecycleOutputBuffer.subscribe({ runId: RUN_ID, subscriber: { onExit: onPanelExit } });
    await lifecycleOutputBuffer.start({ runId: RUN_ID });

    expect(listenMock).toHaveBeenCalledTimes(2);

    handlers.get('provider-lifecycle-output')?.({
      payload: { runId: RUN_ID, providerId: 'anthropic', action: 'install', data: btoa('ok') },
    });
    handlers.get('provider-lifecycle-exit')?.({
      payload: {
        runId: RUN_ID,
        providerId: 'anthropic',
        action: 'install',
        exitCode: 0,
        status: 'installed',
        auth: 'unknown',
      },
    });

    expect(onOutput).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onPanelExit).toHaveBeenCalledTimes(1);
    expect(onPanelExit).toHaveBeenCalledWith(0);
    expect(lifecycleOutputBuffer.snapshotOf({ runId: RUN_ID })).toMatchObject({ exitCode: 0 });
  });
});
