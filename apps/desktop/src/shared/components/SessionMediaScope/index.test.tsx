// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { RemoteImage } from '@goodboy/ui';
import { brandId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { sessionOf } from '../../../features/workspace/testing/sessionColumn';
import { SessionMediaScope } from './index';

const { loadToolImage, loadRemoteImage } = vi.hoisted(() => ({
  loadToolImage: vi.fn(async () => 'data:image/png;base64,tool'),
  loadRemoteImage: vi.fn(async () => 'data:image/png;base64,remote'),
}));

vi.mock('../../lib/remoteImage', () => ({
  loadRemoteImage,
  loadToolImage,
  probeToolMedia: vi.fn(async () => 'image' as const),
}));

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  loadToolImage.mockClear();
  loadRemoteImage.mockClear();
});

afterEach(cleanup);

const ATTACHMENT = 'https://github.com/user-attachments/assets/9f2c-scope';

describe('SessionMediaScope', () => {
  it('loads a pull request attachment with the workspace of the session it names', async () => {
    const session = sessionOf({ goal: 'Ledger export' });
    useAppStore.setState({ sessions: [session] });

    render(
      <SessionMediaScope sessionId={brandId<SessionId>({ value: session.id })}>
        <RemoteImage url={ATTACHMENT} alt="board" />
      </SessionMediaScope>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(loadToolImage).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: session.workspaceId, provider: 'github' }),
    );
  });

  it('adds no scope when no session is named', () => {
    render(
      <SessionMediaScope sessionId={null}>
        <RemoteImage url={ATTACHMENT} alt="board" load={loadRemoteImage} />
      </SessionMediaScope>,
    );

    expect(loadToolImage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Load' })).not.toBeNull();
  });
});
