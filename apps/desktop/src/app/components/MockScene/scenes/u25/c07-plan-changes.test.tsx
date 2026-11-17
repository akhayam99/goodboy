// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import type { AutoSentChange, AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { queueOnlyInvoke } from '../../../../../test/queueOnlyInvoke';
import {
  registerAutoUserTurnPort,
  type AutoUserTurnPort,
} from '../../../../../features/auto/autoUserTurnPort';
import { AUTO_PLAN_ID, AUTO_ROOT_ID, AUTO_SESSION } from '../u24/autoSceneSeed';
import { U25_C07_AUTO_SCENES } from './c07-auto';

const WAIT = { timeout: 15_000 };
const CHANGE = 'Follow the project guidelines and reuse the patterns used elsewhere.';
const BOX = 'Message Lead, or describe changes to plan v1';
const APPROVE = 'Approve and start Build';
const SINCE = brandId<IsoDateTime>({ value: '2026-10-13T12:09:16.000Z' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command?: unknown, args?: unknown) =>
    queueOnlyInvoke({ command, args }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  registerAutoUserTurnPort({ port: null });
});

type MountParams = {
  readonly id: 'c07-auto-plan' | 'c07-auto-plan-changes';
};

const mount = ({ id }: MountParams): void => {
  const Scene = U25_C07_AUTO_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const dock = async (): Promise<HTMLElement> => {
  await screen.findByRole('button', { name: /^Open plan / }, WAIT);
  const found = document.querySelector<HTMLElement>('[data-auto-dock]');
  if (found === null) {
    throw new Error('no dock');
  }
  return found;
};

const leadBox = async (): Promise<HTMLTextAreaElement> => {
  const box = await screen.findByPlaceholderText(BOX, undefined, WAIT);
  if (!(box instanceof HTMLTextAreaElement)) {
    throw new Error('the Lead box is not a textarea');
  }
  return box;
};

type SendParams = {
  readonly box: HTMLTextAreaElement;
};

const send = async ({ box }: SendParams): Promise<void> => {
  fireEvent.change(box, { target: { value: CHANGE } });
  const buttons = await screen.findAllByRole('button', { name: 'Send' });
  const enabled = buttons.find((button) => button instanceof HTMLButtonElement && !button.disabled);
  await userEvent.click(enabled ?? document.body);
};

type ViewPatch = {
  readonly sentChange: AutoSentChange | null;
  readonly revision?: number;
  readonly phase?: AutoTreeView['tree']['phase'];
};

const loadView = ({ sentChange, revision = 1, phase }: ViewPatch): void => {
  act(() => {
    store.setState((state) => ({
      autoTreeViews: {
        ...state.autoTreeViews,
        [AUTO_SESSION.id]: (state.autoTreeViews[AUTO_SESSION.id] ?? []).map((view) =>
          view.tree.rootAgentId !== AUTO_ROOT_ID
            ? view
            : {
                ...view,
                tree: phase === undefined ? view.tree : { ...view.tree, phase },
                sentChange,
                artifacts: view.artifacts.map((row) =>
                  row.artifact.kind === 'plan' ? { ...row, revision } : row,
                ),
              },
        ),
      },
    }));
  });
};

describe('a message to the Lead while its plan waits for approval', () => {
  it('goes to the Lead at once, not to the queue', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    mount({ id: 'c07-auto-plan' });

    await send({ box: await leadBox() });

    await waitFor(() => expect(port).toHaveBeenCalledTimes(1), WAIT);
    expect(port).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: AUTO_ROOT_ID, text: CHANGE }),
    );
    expect(port.mock.calls[0]?.[0].focusArtifactId).toBeUndefined();
    await waitFor(() => expect(store.getState().agentQueue[AUTO_ROOT_ID] ?? []).toEqual([]));
  });

  it('says it went in as changes to plan v1, and drops Approve while the Lead reads it', async () => {
    mount({ id: 'c07-auto-plan' });
    within(await dock()).getByRole('button', { name: APPROVE });

    loadView({ sentChange: { artifactId: AUTO_PLAN_ID, revision: 1 }, phase: 'deciding' });

    const line = await within(await dock()).findByText('Sent as changes to plan v1');
    expect(line.getAttribute('role')).toBe('status');
    expect(screen.queryByRole('button', { name: APPROVE })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask for changes' })).toBeNull();
  });

  it('asks again for v2 once it lands, and a late change for v1 says nothing', async () => {
    mount({ id: 'c07-auto-plan' });
    await dock();

    loadView({ sentChange: { artifactId: AUTO_PLAN_ID, revision: 1 }, revision: 2 });

    await screen.findByText('Plan v2 needs approval', undefined, WAIT);
    expect(screen.queryByText('Sent as changes to plan v1')).toBeNull();
    screen.getByRole('button', { name: APPROVE });
  });

  it('Ask for changes puts the cursor in the same box, which sends the same way', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    mount({ id: 'c07-auto-plan' });

    fireEvent.click(within(await dock()).getByRole('button', { name: 'Ask for changes' }));

    const box = await leadBox();
    await waitFor(() => expect(document.activeElement).toBe(box));
    await send({ box });
    await waitFor(() => expect(port).toHaveBeenCalledTimes(1), WAIT);
    expect(port).toHaveBeenCalledWith(expect.objectContaining({ text: CHANGE }));
  });

  it('waits in the queue while the Lead is working, as today', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    mount({ id: 'c07-auto-plan' });
    const box = await leadBox();
    act(() => {
      store.setState((state) => ({
        agentTurnState: {
          ...state.agentTurnState,
          [AUTO_ROOT_ID]: {
            kind: 'running',
            runId: brandId<ProviderRunId>({ value: 'mock-lead-run' }),
            startedAt: SINCE,
          },
        },
      }));
    });

    fireEvent.change(box, { target: { value: CHANGE } });
    await userEvent.click(await screen.findByRole('button', { name: /^Queue/ }, WAIT));

    await waitFor(() =>
      expect((store.getState().agentQueue[AUTO_ROOT_ID] ?? []).map((turn) => turn.content)).toEqual(
        [CHANGE],
      ),
    );
    expect(port).not.toHaveBeenCalled();
  });

  it('c07-auto-plan-changes shows every window the same line from the stored message', async () => {
    mount({ id: 'c07-auto-plan-changes' });

    await within(await dock()).findByText('Sent as changes to plan v1', undefined, WAIT);
    expect(screen.queryByRole('button', { name: APPROVE })).toBeNull();
  });
});
