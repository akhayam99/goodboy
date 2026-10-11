// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ResolveBatch } from '@goodboy/types';
import { agentIdOf } from '../../../../shared/lib/brandedIds';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { SESSION } from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  BULK_LAUNCH_THREAD_IDS,
  seedBulkScene,
} from '../../../../app/components/MockScene/scenes/bulkSeed';
import { fixCommentsSeed } from '../../../../app/components/MockScene/scenes/u24/fixCommentsSeed';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { draftRoutingOf } from '../../draftRouting';
import { FixCommentsButton } from '../FixCommentsButton';
import { FixCommentsDrawer } from '.';

type StoreState = ReturnType<StoryStore['getState']>;

const BATCH: ResolveBatch = {
  id: 'batch-fix',
  sessionId: SESSION.id,
  threadIds: [],
  launchChoice: {
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: null,
    commitStyle: null,
    hint: null,
  },
  createdAt: 1,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const stubLaunch = () => {
  const spawnAgent = vi.fn<StoreState['spawnAgent']>(async () => agentIdOf({ value: 'agent-new' }));
  const createResolveBatch = vi.fn<StoreState['createResolveBatch']>(async () => BATCH);
  const setAgentConfig = vi.fn<StoreState['setAgentConfig']>(async () => undefined);
  useAppStore.setState({ spawnAgent, createResolveBatch, setAgentConfig });
  return { spawnAgent, createResolveBatch };
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

type MountParams = {
  readonly threadIds: ReadonlyArray<string> | null;
  readonly phase?: 'list' | 'running';
};

const mount = async ({ threadIds, phase = 'list' }: MountParams): Promise<void> => {
  seedBulkScene({ stage: 'launch' });
  if (phase === 'running') {
    fixCommentsSeed({ phase });
  }
  render(
    <ToastProvider>
      <FixCommentsDrawer
        sessionId={SESSION.id}
        focusThreadId={null}
        threadIds={threadIds}
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );
  await settle();
};

const drawer = (): HTMLElement => screen.getByRole('region', { name: 'Fix comments' });

describe('the Fix comments drawer', () => {
  it('lists every open comment of the session and nothing that is closed', async () => {
    await mount({ threadIds: null });

    const rows = within(drawer()).getAllByRole('checkbox');
    expect(rows).toHaveLength(BULK_LAUNCH_THREAD_IDS.length);
    expect(
      within(drawer()).getByRole('button', { name: `Start fix for ${rows.length}` }),
    ).toBeDefined();
  });

  it('starts one fix run for the two selected comments and applies them', async () => {
    const { spawnAgent, createResolveBatch } = stubLaunch();
    await mount({ threadIds: BULK_LAUNCH_THREAD_IDS.slice(0, 2) });

    fireEvent.click(within(drawer()).getByRole('button', { name: 'Start fix for 2' }));

    await waitFor(() => expect(createResolveBatch).toHaveBeenCalledOnce());
    const [call] = createResolveBatch.mock.calls[0] ?? [];
    expect(call?.threadIds).toEqual(BULK_LAUNCH_THREAD_IDS.slice(0, 2));
    expect(call?.launchChoice.mode).toBe('apply');
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      name: 'Fix comments · 2 comments',
      kindOverride: 'resolver',
    });
  });

  it('analyzes only in propose mode and edits nothing on the branch', async () => {
    const { spawnAgent, createResolveBatch } = stubLaunch();
    await mount({ threadIds: BULK_LAUNCH_THREAD_IDS.slice(0, 2) });

    fireEvent.click(within(drawer()).getByRole('button', { name: 'Analyze only' }));

    await waitFor(() => expect(createResolveBatch).toHaveBeenCalledOnce());
    expect(createResolveBatch.mock.calls[0]?.[0].launchChoice.mode).toBe('propose');
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
  });

  it('chains a second launch on a commented thread under the first resolver', async () => {
    const { spawnAgent } = stubLaunch();
    await mount({ threadIds: BULK_LAUNCH_THREAD_IDS.slice(0, 1), phase: 'running' });

    fireEvent.click(within(drawer()).getByRole('button', { name: 'Start fix for 1' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(spawnAgent.mock.calls[0]?.[1].parentAgentId).toBe('agent-fix-comments-1');
    expect(within(drawer()).getAllByRole('button', { name: /^Open agent/ })).toHaveLength(1);
  });

  it('keeps the launch disabled with a reason while nothing is selected', async () => {
    const { createResolveBatch } = stubLaunch();
    await mount({ threadIds: [] });

    const start = within(drawer()).getByRole('button', { name: 'Start fix' });
    expect(start).toHaveProperty('disabled', true);
    expect(within(drawer()).getByText('Select a comment to start')).toBeDefined();
    fireEvent.click(start);
    expect(createResolveBatch).not.toHaveBeenCalled();
  });

  it('shows the model the resolver role resolves to', async () => {
    await mount({ threadIds: null });

    const { model } = draftRoutingOf({ state: useAppStore.getState(), sessionId: SESSION.id });
    const chip = within(drawer()).getByRole('button', { name: /^Model / });
    expect(chip.textContent ?? '').toContain(modelLabel(model ?? ''));
  });
});

describe('the Fix comments button', () => {
  it('shows the count of open comments and opens the drawer on click', async () => {
    seedBulkScene({ stage: 'launch' });
    render(<FixCommentsButton sessionId={SESSION.id} mountId={null} />);

    fireEvent.click(
      await screen.findByRole('button', { name: `Fix comments ${BULK_LAUNCH_THREAD_IDS.length}` }),
    );

    expect(useAppStore.getState().drawer?.kind).toBe('fix-comments');
  });

  it('hides when no comment is open', async () => {
    seedBulkScene({ stage: 'launch' });
    useAppStore.setState({ sessionResolveQueueItems: { [SESSION.id]: [] } });
    render(<FixCommentsButton sessionId={SESSION.id} mountId={null} />);
    await settle();

    expect(screen.queryByRole('button', { name: /^Fix comments/ })).toBeNull();
  });
});
