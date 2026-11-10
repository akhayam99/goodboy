// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }));
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { innerColumnStore } from '@goodboy/ui';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { sessionPlace } from '../../../store/slices/navigation/place';
import type { StudioPlace } from '../../../store/slices/navigation/studio';
import { worktreeStatusOf } from '../../../test/worktreeStatusOf';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { ObjectMenuProvider } from '../../../features/actions/components/ObjectMenuProvider';
import { SessionRail } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const session = sessionOf({ goal: 'Stop retried webhooks' });

const mountRail = (): void => {
  seedColumn({
    store: useAppStore,
    sessions: [session],
    currentSessionId: session.id,
    mounts: [[session, paymentsApi]],
  });
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: session.id }) });
  stubStoryInvoke({
    worktree_status: () => worktreeStatusOf({ behind: 0 }),
    worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
    detect_editors: () => [],
  });
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <SessionRail session={session} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
};

const PAGES: ReadonlyArray<StudioPlace> = [
  { kind: 'guide' },
  { kind: 'changelog' },
  { kind: 'notifications' },
  { kind: 'addWorkspace' },
];

describe('the session rail fold toggle', () => {
  it('owns the inner column key on a session page', () => {
    mountRail();

    expect(innerColumnStore.current()?.id).toBe('session-rail');
  });

  it.each(PAGES.map((page) => [page.kind, page] as const))(
    'hands the key back to the page while %s sits over the session',
    (_name, page) => {
      mountRail();

      act(() => {
        useAppStore.getState().openStudio({ studio: page });
      });

      expect(innerColumnStore.current()?.id).not.toBe('session-rail');
    },
  );
});
