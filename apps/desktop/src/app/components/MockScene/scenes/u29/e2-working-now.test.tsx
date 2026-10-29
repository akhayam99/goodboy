// @vitest-environment happy-dom

vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 29, 10, 31));
});
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AutoDelegation } from '@goodboy/db';
import { brandId, type AgentId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { AUTO_ROOT_ID, AUTO_SESSION, IMPLEMENTER_ID, TESTER_ID } from '../u24/autoSceneSeed';
import { U25_C07_AUTO_SCENES } from '../u25/c07-auto';
import { U29_E2_WORKING_NOW_SCENES } from './e2-working-now';

let useAppStore: StoryStore;

const WAIT = { timeout: 15_000 };
const scrollSpy = vi.fn();
const pendingInvoke = () => new Promise<never>(() => undefined);
const IMPLEMENTER_TITLE = 'Post one credit per retry in postCredit and applyCredit';
const TESTER_TITLE = 'Test the retry path with a timeout on the first attempt';

type MountParams = {
  readonly hasTwoChildren?: boolean;
  readonly isRootRunning?: boolean;
};

const mount = async ({ hasTwoChildren = false, isRootRunning = true }: MountParams = {}) => {
  const Scene = isRootRunning
    ? U29_E2_WORKING_NOW_SCENES[hasTwoChildren ? 'e2-working-now-two' : 'e2-working-now-one']
    : U25_C07_AUTO_SCENES['c07-auto-working'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('group', { name: 'Working now' }, WAIT);
};

type UpdateParams = {
  readonly agentId: AgentId;
  readonly state: AutoDelegation['state'];
};

const updateChild = ({ agentId, state }: UpdateParams): void => {
  act(() =>
    useAppStore.setState((current) => ({
      autoTreeViews: {
        ...current.autoTreeViews,
        [AUTO_SESSION.id]: (current.autoTreeViews[AUTO_SESSION.id] ?? []).map((view) => ({
          ...view,
          delegations: view.delegations.map((delegation) =>
            delegation.childAgentId === agentId
              ? { ...delegation, state, outcome: state === 'settled' ? 'completed' : null }
              : delegation,
          ),
        })),
      },
    })),
  );
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_execute: pendingInvoke,
    db_select: pendingInvoke,
    worktree_status: pendingInvoke,
    worktree_remote_url: pendingInvoke,
    worktree_changed_files: pendingInvoke,
    project_git_status: pendingInvoke,
    check_provider_budget: pendingInvoke,
    workflow_list: pendingInvoke,
    turn_quiet: [],
  });
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date(2026, 9, 29, 10, 31));
  scrollSpy.mockClear();
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (
    this: Element,
    options,
  ) {
    scrollSpy(this.getAttribute('data-agent-id'), options);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Working now in Auto', () => {
  it('starts hidden when no child is running', async () => {
    const Scene = U25_C07_AUTO_SCENES['c07-auto-idle'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await screen.findByPlaceholderText('Message Auto', undefined, WAIT);
    expect(screen.queryByRole('group', { name: 'Working now' })).toBeNull();
  });

  it('shows one running child with its clock while Auto waits, excluding queued children', async () => {
    const strip = await mount({ isRootRunning: false });
    expect(within(strip).getAllByRole('button')).toHaveLength(1);
    within(strip).getByText(IMPLEMENTER_TITLE);
    expect(within(strip).queryByText(TESTER_TITLE)).toBeNull();
    expect(strip.querySelector('[data-delegation-clock]')?.textContent).toMatch(/\d/);
    screen.getByPlaceholderText('Message Auto');
  });

  it('keeps the strip while Auto replies and shows two children newest first', async () => {
    const strip = await mount({ hasTwoChildren: true });
    expect(useAppStore.getState().agentTurnState[AUTO_ROOT_ID]?.kind).toBe('running');
    expect(
      within(strip)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([`Reveal ${TESTER_TITLE} in Agents`, `Reveal ${IMPLEMENTER_TITLE} in Agents`]);
    expect(strip.querySelectorAll('[data-delegation-clock]')).toHaveLength(2);
    screen.getByPlaceholderText('Message Auto');
  });

  it('reveals the clicked child in Agents and preserves Auto and its message draft', async () => {
    const strip = await mount();
    const composer = screen.getByPlaceholderText('Message Auto');
    fireEvent.change(composer, { target: { value: 'Review the ledger-core changes' } });
    const navigation = useAppStore.getState().navigation;
    fireEvent.click(within(strip).getByRole('button'));
    const panel = await screen.findByRole('region', { name: 'Agents' }, WAIT);
    const row = within(panel).getByRole('treeitem', { name: /^Implementer, / });
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(useAppStore.getState().selectedAgentId[AUTO_SESSION.id]).toBe(AUTO_ROOT_ID);
    expect(useAppStore.getState().navigation).toEqual(navigation);
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'spawned',
      sessionId: AUTO_SESSION.id,
      payload: { agentId: IMPLEMENTER_ID },
    });
    expect(screen.getByPlaceholderText('Message Auto')).toBe(composer);
    expect(screen.getByDisplayValue('Review the ledger-core changes')).toBe(composer);
    expect(scrollSpy).toHaveBeenCalledWith(IMPLEMENTER_ID, { block: 'center' });
  });

  it('Open from a delegation reveals the child while Auto stays in view', async () => {
    await mount();
    const lists = screen.getAllByRole('list', { name: 'Delegations' });
    const open = lists.flatMap((list) =>
      within(list).queryAllByRole('button', { name: /^Open Post one credit/ }),
    )[0];
    if (open === undefined) {
      throw new Error('No child Open action');
    }
    fireEvent.click(open);
    const panel = await screen.findByRole('region', { name: 'Agents' }, WAIT);
    expect(
      within(panel)
        .getByRole('treeitem', { name: /^Implementer, / })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(useAppStore.getState().selectedAgentId[AUTO_SESSION.id]).toBe(AUTO_ROOT_ID);
    screen.getByPlaceholderText('Message Auto');
  });

  it('returns from All launches to the child selected by a different chip', async () => {
    const strip = await mount({ hasTwoChildren: true });
    fireEvent.click(
      within(strip).getByRole('button', { name: `Reveal ${IMPLEMENTER_TITLE} in Agents` }),
    );
    const panel = await screen.findByRole('region', { name: 'Agents' }, WAIT);
    fireEvent.click(within(panel).getByRole('button', { name: 'All launches' }));
    expect(document.querySelector('[data-spawned-panel]')?.getAttribute('data-spawned-panel')).toBe(
      'all',
    );
    fireEvent.click(
      within(strip).getByRole('button', { name: `Reveal ${IMPLEMENTER_TITLE} in Agents` }),
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-spawned-panel]')?.getAttribute('data-spawned-panel'),
      ).toBe('auto'),
    );
    fireEvent.click(within(panel).getByRole('button', { name: 'All launches' }));
    fireEvent.click(
      within(strip).getByRole('button', { name: `Reveal ${TESTER_TITLE} in Agents` }),
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-spawned-panel]')?.getAttribute('data-spawned-panel'),
      ).toBe('auto'),
    );
    expect(
      within(panel)
        .getByRole('treeitem', { name: /^Tester, / })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('removes settled children and stays hidden after a late clock tick', async () => {
    const strip = await mount({ hasTwoChildren: true });
    const clockBefore = strip.querySelector('[data-delegation-clock]')?.textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(strip.querySelector('[data-delegation-clock]')?.textContent).not.toBe(clockBefore);
    updateChild({ agentId: TESTER_ID, state: 'settled' });
    expect(
      within(screen.getByRole('group', { name: 'Working now' })).getAllByRole('button'),
    ).toHaveLength(1);
    updateChild({ agentId: IMPLEMENTER_ID, state: 'settled' });
    expect(screen.queryByRole('group', { name: 'Working now' })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(useAppStore.getState().agentTurnState[IMPLEMENTER_ID]?.kind).toBe('running');
    expect(screen.queryByRole('group', { name: 'Working now' })).toBeNull();
  });

  it('shows a starting child but excludes paused and confirmation children', async () => {
    await mount();
    updateChild({ agentId: IMPLEMENTER_ID, state: 'starting' });
    screen.getByRole('group', { name: 'Working now' });
    updateChild({ agentId: IMPLEMENTER_ID, state: 'paused' });
    expect(screen.queryByRole('group', { name: 'Working now' })).toBeNull();
    updateChild({ agentId: IMPLEMENTER_ID, state: 'awaiting_confirm' });
    expect(screen.queryByRole('group', { name: 'Working now' })).toBeNull();
  });

  it('falls back to launches for a missing reveal target without changing the main selection', async () => {
    await mount();
    act(() =>
      useAppStore.getState().openDrawer({
        kind: 'spawned',
        sessionId: AUTO_SESSION.id,
        payload: { agentId: brandId<AgentId>({ value: 'missing-harborline-agent' }) },
      }),
    );
    await screen.findByRole('region', { name: 'Agents' }, WAIT);
    expect(document.querySelector('[data-spawned-panel]')?.getAttribute('data-spawned-panel')).toBe(
      'all',
    );
    expect(useAppStore.getState().selectedAgentId[AUTO_SESSION.id]).toBe(AUTO_ROOT_ID);
  });
});
