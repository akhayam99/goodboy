// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../hooks/useBootstrapWatch', () => ({ useBootstrapWatch: () => undefined }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BootstrapPhase, RemoteProbe, WorkspaceGitStatus } from '@goodboy/types';
import { aProject, aSession, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';

let useAppStore: StoryStore;
let FirstLapBanner: typeof import('./index').FirstLapBanner;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ FirstLapBanner } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

const session = aSession({ goal: 'First lap' });
const project = aProject({ workspaceId: session.workspaceId, name: 'cascadia', kind: 'repo' });
const withRemote = { ...project, remoteUrl: 'https://example.invalid/cascadia.git' };
const bootstrapSession = aSession({ goal: 'bootstrap', workspaceId: session.workspaceId });

const phase = (patch: Partial<BootstrapPhase> = {}): BootstrapPhase => ({
  stage: 'first-lap',
  firstLapSessionId: session.id,
  bootstrapSessionId: null,
  snapshotId: null,
  worktreePath: null,
  branch: null,
  updatedAt: TEST_NOW,
  ...patch,
});

const gitStatus = (changed: number): WorkspaceGitStatus => ({
  state: 'ready',
  branch: 'main',
  headSubject: 'chore: track this project with git',
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  workingTree: { kind: 'known', staged: 0, unstaged: changed, untracked: 0, unmerged: 0, changed },
  upstream: null,
  inProgress: null,
});

type SeedParams = {
  readonly stage?: BootstrapPhase;
  readonly probe?: RemoteProbe | null;
  readonly hasRemote?: boolean;
  readonly answer?: RemoteProbe;
};

const seed = ({
  stage = phase(),
  probe = null,
  hasRemote = false,
  answer = { kind: 'main-present', branch: 'main', sha: 'abc1234' },
}: SeedParams = {}) => {
  useAppStore.setState({
    sessions: [session, bootstrapSession],
    projects: [hasRemote ? withRemote : project],
    bootstrapPhase: { [project.id]: stage },
    bootstrapRemoteProbe: probe === null ? {} : { [project.id]: { probe, readAt: TEST_NOW } },
    projectGitStatus: { [project.id]: gitStatus(2) },
    loadProjectGitStatus: async () => undefined,
    probeProjectRemote: async ({ projectId }) => {
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

beforeEach(async () => {
  await resetStoryStore();
  seed();
});

afterEach(cleanup);

describe('FirstLapBanner', () => {
  it('says where the session works and leaves Publish to the Projects row', () => {
    render(<FirstLapBanner sessionId={session.id} />);

    screen.getByText('cascadia · This session works in your project folder');
    screen.getByText('Nothing is published yet.');
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });

  it('shows the move card once main is on the remote', () => {
    seed({ probe: { kind: 'main-present', branch: 'main', sha: 'abc' } });
    render(<FirstLapBanner sessionId={session.id} />);

    screen.getByText('cascadia · main is on the remote now.');
    screen.getByRole('button', { name: 'Move my work' });
  });

  it('holds a placeholder while it checks a remote it has not read yet', () => {
    seed({ hasRemote: true });
    render(<FirstLapBanner sessionId={session.id} />);

    screen.getByRole('status', { name: 'Checking the remote' });
    expect(screen.queryByText("Couldn't check the remote")).toBeNull();
  });

  it('says it cannot check the remote as a notice, and tries again on demand', async () => {
    seed({ hasRemote: true, probe: { kind: 'unreachable', reason: 'offline' } });
    render(<FirstLapBanner sessionId={session.id} />);

    screen.getByText("Couldn't check the remote");
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await waitFor(() => screen.getByRole('button', { name: 'Move my work' }));
    expect(screen.queryByText("Couldn't check the remote")).toBeNull();
  });

  it('stays quiet about the remote when the project has none', () => {
    seed({ probe: { kind: 'unreachable', reason: 'offline' } });
    render(<FirstLapBanner sessionId={session.id} />);

    expect(screen.queryByText("Couldn't check the remote")).toBeNull();
  });

  it('resumes an interrupted move once and opens bootstrap when it finishes', async () => {
    let resumed = 0;
    seed({ stage: phase({ stage: 'moving' }) });
    useAppStore.setState({
      resumeBootstrapMove: async () => {
        resumed += 1;
        return { kind: 'refused', reason: 'failed', message: 'The copy did not match.' };
      },
    });
    render(<FirstLapBanner sessionId={session.id} />);

    screen.getByText('Moving your work into bootstrap');
    await waitFor(() => screen.getByText('The copy did not match.'));
    expect(resumed).toBe(1);
  });

  it('renders nothing for a session that is not a first lap', () => {
    const { container } = render(<FirstLapBanner sessionId={bootstrapSession.id} />);

    expect(container.textContent).toBe('');
  });
});
