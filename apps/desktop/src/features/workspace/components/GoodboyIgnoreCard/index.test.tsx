// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { at } from '../../testing/sessionColumn';
import { GoodboyIgnoreCard } from './index';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const ACME = 'acme' as ProjectId;
const CASCADIA = 'cascadia' as ProjectId;
const TITLE = "Git doesn't ignore .goodboy in 2 folders";

let useAppStore: StoryStore;

const pendingProject = ({ id }: { id: ProjectId }) =>
  aProject({
    id,
    workspaceId: WORKSPACE_ID,
    name: id,
    rootPath: `/code/${id}`,
    kind: 'repo',
    goodboyIgnoreCheckedAt: at('2026-09-25T00:00:00.000Z'),
  });

const seedPending = () => {
  act(() => {
    useAppStore.setState({
      projects: [pendingProject({ id: ACME }), pendingProject({ id: CASCADIA })],
    });
  });
};

const applyCalls = () =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'goodboy_ignore_apply');

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    goodboy_ignore_apply: async () => ({ source: 'global', path: null, line: null }),
  });
  seedPending();
});

afterEach(cleanup);

describe('GoodboyIgnoreCard', () => {
  it('asks the question once for every unanswered project', () => {
    render(<GoodboyIgnoreCard workspaceId={WORKSPACE_ID} />);

    expect(screen.getByText(TITLE).textContent).toBe(TITLE);
    expect(screen.getByText('Save for 2 folders').textContent).toBe('Save for 2 folders');
  });

  it('saves this-mac by default for every pending project, then hides the card', async () => {
    render(<GoodboyIgnoreCard workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByText('Save for 2 folders'));

    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());
    expect(applyCalls().map(([, args]) => args)).toEqual([
      { args: { repoPath: '/code/acme', target: 'this-mac' } },
      { args: { repoPath: '/code/cascadia', target: 'this-mac' } },
    ]);
    expect(useAppStore.getState().projects.map((project) => project.goodboyIgnore)).toEqual([
      'this-mac',
      'this-mac',
    ]);
  });

  it('keeps the card and shows the error when git still shows the folder, then saves on retry', async () => {
    stubStoryInvoke({
      goodboy_ignore_apply: async () => ({ source: 'not-ignored', path: null, line: null }),
    });
    render(<GoodboyIgnoreCard workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByText('Save for 2 folders'));

    await screen.findByRole('alert');
    expect(screen.getByText(TITLE).textContent).toBe(TITLE);
    expect(useAppStore.getState().projects.map((project) => project.goodboyIgnore)).toEqual([
      undefined,
      undefined,
    ]);

    stubStoryInvoke({
      goodboy_ignore_apply: async () => ({ source: 'global', path: null, line: null }),
    });
    fireEvent.click(screen.getByText('Save for 2 folders'));

    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());
    expect(useAppStore.getState().projects.map((project) => project.goodboyIgnore)).toEqual([
      'this-mac',
      'this-mac',
    ]);
  });

  it('hides the card without saving when choosing per project', () => {
    render(<GoodboyIgnoreCard workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByText('Choose per folder'));

    expect(applyCalls()).toEqual([]);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('renders nothing once every project already has an answer', () => {
    act(() => {
      useAppStore.setState({ projects: [] });
    });
    const { container } = render(<GoodboyIgnoreCard workspaceId={WORKSPACE_ID} />);

    expect(container.firstChild).toBeNull();
  });
});
