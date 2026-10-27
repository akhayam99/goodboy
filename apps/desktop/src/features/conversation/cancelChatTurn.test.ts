// @vitest-environment node
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type ProviderRunId } from '@goodboy/types';
import { storySpies } from '../../store/storyHarness';
import { cancelChatTurn } from './cancelChatTurn';

const RUN = brandId<ProviderRunId>({ value: 'run-harborline' });

beforeEach(() => {
  storySpies.tauriInvoke.mockReset();
});

describe('cancelChatTurn', () => {
  it('asks the host to cancel the run it names', async () => {
    storySpies.tauriInvoke.mockResolvedValue(undefined);

    await cancelChatTurn({ runId: RUN });

    expect(storySpies.tauriInvoke.mock.calls[0]?.[0]).toBe('chat_cancel');
    expect(storySpies.tauriInvoke.mock.calls[0]?.[1]).toEqual({ runId: RUN });
  });

  it('resolves when the host has no such run, so Stop never throws', async () => {
    storySpies.tauriInvoke.mockRejectedValue(new Error('no such run'));

    await expect(cancelChatTurn({ runId: RUN })).resolves.toBeUndefined();
  });
});
