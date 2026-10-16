// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RemoteProbe } from '@goodboy/types';
import { aProject, aSession, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';

let useAppStore: StoryStore;
let LapPublishNotice: typeof import('./LapPublishNotice').LapPublishNotice;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ LapPublishNotice } = await import('./LapPublishNotice'));
}, STORE_IMPORT_TIMEOUT_MS);

const session = aSession({ goal: 'First lap' });
const project = aProject({ workspaceId: session.workspaceId, name: 'cascadia', kind: 'repo' });
const withRemote = { ...project, remoteUrl: 'https://example.invalid/cascadia.git' };

type SeedParams = {
  readonly probe?: RemoteProbe | null;
  readonly hasRemote?: boolean;
};

const seed = ({ probe = null, hasRemote = false }: SeedParams = {}) => {
  useAppStore.setState({
    sessions: [session],
    projects: [hasRemote ? withRemote : project],
    bootstrapRemoteProbe: probe === null ? {} : { [project.id]: { probe, readAt: TEST_NOW } },
    probeProjectRemote: async ({ projectId }) => {
      const answer: RemoteProbe = { kind: 'main-present', branch: 'main', sha: 'abc1234' };
      useAppStore.setState((state) => ({
        bootstrapRemoteProbe: {
          ...state.bootstrapRemoteProbe,
          [projectId]: { probe: answer, readAt: TEST_NOW },
        },
      }));
      return answer;
    },
  });
};

const mount = ({ hasRemote = false }: { readonly hasRemote?: boolean } = {}) =>
  render(
    <ToastProvider>
      <LapPublishNotice
        sessionId={session.id}
        project={hasRemote ? withRemote : project}
        stage="first-lap"
      />
    </ToastProvider>,
  );

beforeEach(async () => {
  await resetStoryStore();
  seed();
});

afterEach(cleanup);

describe('LapPublishNotice', () => {
  it('says once that nothing is published, with Publish beside it', () => {
    mount();

    expect(screen.getAllByText('Not published yet')).toHaveLength(1);
    expect(screen.queryByText(/not published/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('says it is checking a remote it has not read yet', () => {
    seed({ hasRemote: true });
    mount({ hasRemote: true });

    expect(screen.getByText('Checking the remote')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('offers Retry when the remote did not answer, and leaves once main is there', async () => {
    seed({ hasRemote: true, probe: { kind: 'unreachable', reason: 'offline' } });
    const view = mount({ hasRemote: true });

    expect(
      screen.getByText("Couldn't check the remote. Publishing needs it to answer."),
    ).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await waitFor(() => expect(view.container.textContent).toBe(''));
  });

  it('draws nothing once main is on the remote', () => {
    seed({ probe: { kind: 'main-present', branch: 'main', sha: 'abc' } });
    const view = mount();

    expect(view.container.textContent).toBe('');
  });
});
