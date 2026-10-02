// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BootstrapPhase, RemoteProbe } from '@goodboy/types';
import { aProject, aSession, TEST_NOW } from '@goodboy/types/testing';

const session = aSession({ goal: 'First lap' });
const project = aProject({ workspaceId: session.workspaceId, name: 'cascadia', kind: 'repo' });
const bootstrapSession = aSession({ goal: 'bootstrap' });

const h = vi.hoisted(() => ({
  live: [] as string[],
  store: {} as Record<string, unknown>,
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) => selector(h.store),
}));
vi.mock('../../../store/slices/live-work/selectLiveWork', () => ({
  selectLiveWork: () => ({ liveSessionIds: h.live }),
}));
vi.mock('../hooks/useBootstrapWatch', () => ({ useBootstrapWatch: vi.fn() }));
vi.mock('../PublishPanel', () => ({
  PublishPanel: ({ primaryLabel }: { primaryLabel?: string }) => (
    <div>publish panel {primaryLabel}</div>
  ),
}));

import { FirstLapBanner } from './index';

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

const workingTree = (changed: number) => ({
  state: 'ready',
  workingTree: { kind: 'known', staged: 0, unstaged: changed, untracked: 0, unmerged: 0, changed },
});

const setStore = ({ stage = phase(), probe = null as RemoteProbe | null, changed = 0 } = {}) => {
  h.store = {
    sessions: [session],
    projects: [project],
    bootstrapPhase: { [project.id]: stage },
    bootstrapRemoteProbe: probe === null ? {} : { [project.id]: { probe, readAt: TEST_NOW } },
    bootstrapMoveReport: {},
    projectGitStatus: { [project.id]: workingTree(changed) },
    loadProjectGitStatus: vi.fn(async () => undefined),
    moveToBootstrap: vi.fn(async () => ({ kind: 'moved', session: bootstrapSession, report: {} })),
    resumeBootstrapMove: vi.fn(async () => ({
      kind: 'moved',
      session: bootstrapSession,
      report: {},
    })),
    dismissBootstrapReport: vi.fn(),
    navigate: vi.fn(),
  };
};

beforeEach(() => {
  h.live = [];
  setStore();
});

afterEach(cleanup);

describe('FirstLapBanner', () => {
  it('says where the session works and offers Publish', () => {
    render(<FirstLapBanner sessionId={session.id} />);

    expect(screen.getByText('cascadia · project folder · main')).toBeDefined();
    expect(
      screen.getByText('This session works in your project folder. Nothing is published yet.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByText(/publish panel/)).toBeDefined();
  });

  it('folds the move into Publish when there is work to move', () => {
    setStore({ changed: 4 });
    render(<FirstLapBanner sessionId={session.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(screen.getByText('publish panel Publish and move my work')).toBeDefined();
  });

  it('shows the move card once main is on the remote', () => {
    setStore({ probe: { kind: 'main-present', branch: 'main', sha: 'abc' }, changed: 2 });
    render(<FirstLapBanner sessionId={session.id} />);

    expect(screen.getByText('main is on the remote now.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Move my work' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });

  it('says it cannot check the remote only when the project has one', () => {
    setStore({ probe: { kind: 'unreachable', reason: 'offline' } });
    const first = render(<FirstLapBanner sessionId={session.id} />);
    expect(screen.queryByText("Couldn't check the remote")).toBeNull();
    first.unmount();

    h.store = { ...h.store, projects: [{ ...project, remoteUrl: 'https://example.com/a/b.git' }] };
    render(<FirstLapBanner sessionId={session.id} />);
    expect(screen.getByText("Couldn't check the remote")).toBeDefined();
  });

  it('resumes an interrupted move once and opens bootstrap when it finishes', async () => {
    setStore({ stage: phase({ stage: 'moving' }) });
    render(<FirstLapBanner sessionId={session.id} />);

    expect(screen.getByText('Moving your work into bootstrap')).toBeDefined();
    await waitFor(() => expect(h.store.navigate).toHaveBeenCalledTimes(1));
    expect(h.store.resumeBootstrapMove).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a session that is not a first lap', () => {
    const { container } = render(<FirstLapBanner sessionId={bootstrapSession.id} />);

    expect(container.textContent).toBe('');
  });
});
