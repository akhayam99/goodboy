// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { SESSION_ID } from '../resolveSeed';
import { REBASE_ALL_MOUNTS } from './rebaseSeed';
import { U26_REBASE_SCENES } from './rebase';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U26_REBASE_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U26_REBASE_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

type NodeParams = {
  readonly node: HTMLElement;
};

const isChecked = ({ node }: NodeParams): boolean =>
  node instanceof HTMLInputElement && node.checked;

type NameParams = {
  readonly name: string;
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
};

const firstMountId = () => {
  const [first] = useAppStore.getState().sessionProjectMounts[SESSION_ID] ?? [];
  if (first === undefined) {
    throw new Error('the scene has no mount');
  }
  return first.mountId;
};

describe('the u26 rebase scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U26_REBASE_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('asks inline on a conflict, in the rail and on the Branch page, and starts nothing by itself', async () => {
    const spawnAgent = vi.fn(async () => {
      throw new Error('nothing may start by itself');
    });
    useAppStore.setState({ spawnAgent });
    await mount({ name: 'u26-rebase-conflict-dark' });

    const prompts = screen
      .getAllByRole('alert')
      .filter((node) => (node.textContent ?? '').includes('2 files conflict with main'));
    expect(prompts.length).toBe(2);
    for (const prompt of prompts) {
      const inPrompt = within(prompt);
      expect(inPrompt.getByRole('button', { name: 'Resolve with Auto' })).toBeDefined();
      expect(inPrompt.getByRole('button', { name: 'Open terminal here' })).toBeDefined();
      expect(inPrompt.getByRole('button', { name: 'Abort rebase' })).toBeDefined();
      expect(inPrompt.getByRole('button', { name: /Add a hint/ })).toBeDefined();
      expect(
        prompt
          .querySelector('[data-rebase-conflict-count]')
          ?.getAttribute('data-rebase-conflict-count'),
      ).toBe('2');
    }
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('hands the conflict to Auto with the hint the person wrote', async () => {
    await mount({ name: 'u26-rebase-conflict-dark' });
    const resolveRebaseWithAuto = vi.fn<AppStore['resolveRebaseWithAuto']>(async () => ({
      kind: 'nothing',
    }));
    useAppStore.setState({ resolveRebaseWithAuto });
    useAppStore.getState().setStartHint({
      sessionId: SESSION_ID,
      scope: `rebase:${firstMountId()}`,
      text: 'Keep the dedupe window from main.',
    });
    await settle();

    const [prompt] = screen
      .getAllByRole('alert')
      .filter((node) => (node.textContent ?? '').includes('conflict with main'));
    if (prompt === undefined) {
      throw new Error('no conflict prompt');
    }
    fireEvent.click(within(prompt).getByRole('button', { name: 'Resolve with Auto' }));
    await settle();

    expect(resolveRebaseWithAuto).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        mountIds: [firstMountId()],
        hint: 'Keep the dedupe window from main.',
      }),
    );
  });

  it('leaves the branch as it was on Abort rebase and closes the prompt', async () => {
    await mount({ name: 'u26-rebase-conflict-light' });
    const [prompt] = screen
      .getAllByRole('alert')
      .filter((node) => (node.textContent ?? '').includes('conflict with main'));
    if (prompt === undefined) {
      throw new Error('no conflict prompt');
    }
    fireEvent.click(within(prompt).getByRole('button', { name: 'Abort rebase' }));
    await settle();

    expect(useAppStore.getState().historyRuns[firstMountId()]).toBeUndefined();
    expect(screen.queryAllByText(/conflict with main/)).toEqual([]);
  });

  it('offers Rebase all on the Projects card when two or more branches are behind', async () => {
    await mount({ name: 'u26-rebase-all-idle-dark' });
    const rebaseAll = vi.fn<AppStore['rebaseAll']>(async () => 'done');
    useAppStore.setState({ rebaseAll });
    await settle();

    expect(screen.getByText('3 branches behind')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Rebase all' }));
    await settle();

    expect(rebaseAll).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountIds: REBASE_ALL_MOUNTS.map((entry) => entry.mountId),
      shouldTidy: false,
    });
  });

  it('reads the progress per branch and stops the rest on Abort', async () => {
    await mount({ name: 'u26-rebase-all-running-dark' });

    const lineOf = ({ name }: NameParams): string => {
      const node = [...document.querySelectorAll('[data-rebase-all-branch]')].find((row) =>
        (row.textContent ?? '').includes(name),
      );
      return node?.textContent ?? '';
    };
    expect(lineOf({ name: 'ledger-core' })).toContain('Rebased');
    expect(lineOf({ name: 'notify-relay' })).toContain('Conflict in 2 files');
    expect(lineOf({ name: 'payments-api' })).toContain('Replaying 2 of 5');
    expect(screen.getByRole('status').textContent).toContain('Rebasing 3 of 3 branches');

    fireEvent.click(screen.getByRole('button', { name: 'Abort' }));
    await settle();

    expect(useAppStore.getState().rebaseAllRuns[SESSION_ID]?.isAborted).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Stopping after this branch');
  });

  it('opens one picker with every behind branch checked, and Rebase N after unchecking', async () => {
    await mount({ name: 'u26-rebase-picker-dark' });
    const rebaseAll = vi.fn<AppStore['rebaseAll']>(async () => 'handed');
    useAppStore.setState({ rebaseAll });

    const picker = within(screen.getByRole('group', { name: 'Branches to rebase' }));
    const boxes = picker.getAllByRole('checkbox');
    expect(boxes.map((box) => isChecked({ node: box }))).toEqual([true, true, true, false]);
    expect(picker.getByRole('button', { name: 'Rebase all' })).toBeDefined();

    fireEvent.click(picker.getByRole('checkbox', { name: /payments-api/ }));
    expect(picker.getByRole('button', { name: 'Rebase 2' })).toBeDefined();

    fireEvent.click(picker.getByRole('checkbox', { name: /Also tidy commits with Auto/ }));
    fireEvent.click(picker.getByRole('button', { name: 'Rebase 2' }));
    await settle();

    const [ledger, relay] = REBASE_ALL_MOUNTS;
    expect(rebaseAll).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountIds: [ledger?.mountId, relay?.mountId],
      shouldTidy: true,
    });
  });

  it('keeps tidy off by default and disables the start when no branch is checked', async () => {
    await mount({ name: 'u26-rebase-picker-light' });
    const picker = within(screen.getByRole('group', { name: 'Branches to rebase' }));
    expect(
      isChecked({ node: picker.getByRole('checkbox', { name: /Also tidy commits with Auto/ }) }),
    ).toBe(false);
    for (const name of ['ledger-core', 'notify-relay', 'payments-api']) {
      fireEvent.click(picker.getByRole('checkbox', { name: new RegExp(name) }));
    }
    const start = picker.getByRole('button', { name: 'Rebase' });
    expect(start.hasAttribute('disabled')).toBe(true);
  });
});
