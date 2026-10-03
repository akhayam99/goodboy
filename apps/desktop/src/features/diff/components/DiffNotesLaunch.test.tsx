// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AgentId, IsoDateTime, ProjectId, ResolveBatch } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { FIRST_LAP_REFUSAL } from '../../../store/slices/bootstrap/firstLap';
import { freshBootstrapPhase } from '../../../store/slices/bootstrap/phase';
import { SESSION_ID, WORKSPACE_ID } from '../../../app/components/MockScene/scenes/resolveSeed';
import {
  NOTE_IDS,
  seedResolveNotes,
} from '../../../app/components/MockScene/scenes/resolveNotesSeed';
import { noteThreadId } from '../../resolve/notes/noteThread';
import { DiffNotesLaunch } from './DiffNotesLaunch';

type StoreState = ReturnType<StoryStore['getState']>;

const CHOSEN = { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' } as const;

const THREAD_IDS = [
  noteThreadId({ noteId: NOTE_IDS.open }),
  noteThreadId({ noteId: NOTE_IDS.openSecond }),
];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveNotes();
});

afterEach(cleanup);

const batchOf = (threadIds: ReadonlyArray<string>): ResolveBatch => ({
  id: 'batch-notes',
  sessionId: SESSION_ID,
  threadIds,
  launchChoice: { ...CHOSEN, commitStyle: 'new', hint: null },
  createdAt: 1,
});

describe('DiffNotesLaunch', () => {
  it('starts one fixer per note on the chosen model, then opens the notes summary', async () => {
    const spawnAgent = vi.fn<StoreState['spawnAgent']>(
      async (_sessionId, args) => `agent-${args.sourceThreadIds?.[0] ?? 'none'}` as AgentId,
    );
    const createResolveBatch = vi.fn<StoreState['createResolveBatch']>(async ({ threadIds }) =>
      batchOf(threadIds),
    );
    useAppStore.setState({ spawnAgent, createResolveBatch });
    useAppStore
      .getState()
      .setResolveQueueView({ sessionId: SESSION_ID, patch: { lastRouting: CHOSEN } });
    useAppStore.getState().showDiffNoteLaunch({ sessionId: SESSION_ID, threadIds: THREAD_IDS });
    render(<DiffNotesLaunch sessionId={SESSION_ID} />);

    const strip = screen.getByRole('region', { name: 'Fix launch' });
    expect(spawnAgent).not.toHaveBeenCalled();
    fireEvent.click(within(strip).getByRole('button', { name: /^Start 2 agents/ }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(2));
    expect(spawnAgent.mock.calls.map(([, args]) => args.sourceThreadIds)).toEqual(
      THREAD_IDS.map((threadId) => [threadId]),
    );
    expect(new Set(spawnAgent.mock.calls.map(([, args]) => args.model))).toEqual(
      new Set([CHOSEN.model]),
    );
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Fix launch' })).toBeNull());
    expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('diff-notes');
    expect(screen.getByRole('status').textContent).toMatch(/^2 agents started on /);
  });

  it('says why a first lap session cannot fix instead of a silent click', () => {
    const project = buildStoryProject({
      id: 'mock-first-lap-project' as ProjectId,
      workspaceId: WORKSPACE_ID,
      name: 'storefront-web',
      kind: 'repo',
    });
    useAppStore.setState({
      projects: [project],
      bootstrapPhase: {
        [project.id]: {
          ...freshBootstrapPhase('2026-09-04T14:20:00.000Z' as IsoDateTime),
          firstLapSessionId: SESSION_ID,
        },
      },
    });
    useAppStore.getState().showDiffNoteLaunch({ sessionId: SESSION_ID, threadIds: THREAD_IDS });
    render(<DiffNotesLaunch sessionId={SESSION_ID} />);

    expect(screen.getByRole('alert').textContent).toBe(FIRST_LAP_REFUSAL);
    expect(screen.queryByRole('button', { name: /^Start/ })).toBeNull();
  });
});
