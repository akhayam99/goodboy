// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AgentId } from '@goodboy/types';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { sceneInvoke, clearSceneInvoke } from '../../../test/sceneInvoke';
import { checksAnalyzeSeed } from '../../../app/components/MockScene/scenes/u24/checksAnalyzeSeed';
import { BranchChecks } from './BranchChecks';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'gh_run') {
      return Promise.resolve({ stdout: 'Assertion failed', stderr: '', exitCode: 0 });
    }
    return sceneInvoke({ command, args });
  });
  storySpies.worktreeChangedFiles.mockResolvedValue(
    Object.assign(
      { files: [], numstat: '' },
      { paths: ['src/ledger.ts'], entries: [], additions: 0, deletions: 0 },
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type SeedParams = {
  readonly phase: Parameters<typeof checksAnalyzeSeed>[0]['phase'];
};

const show = ({ phase }: SeedParams) => {
  const seed = checksAnalyzeSeed({ phase });
  render(
    <ToastProvider>
      <BranchChecks sessionId={seed.sessionId} />
    </ToastProvider>,
  );
  const row = document.querySelector<HTMLElement>(`[data-check-row="${seed.check.name}"]`);
  if (row === null) {
    throw new Error('The failing check row is missing');
  }
  return { seed, row };
};

type RowParams = {
  readonly row: HTMLElement;
};

const workStateOf = ({ row }: RowParams): string | null =>
  row.querySelector('[data-item-work]')?.getAttribute('data-item-work-state') ?? null;

const durationOf = ({ row }: RowParams): string =>
  row.querySelector('button > span:last-child')?.textContent ?? '';

type Deferred = {
  readonly promise: Promise<AgentId>;
  readonly reject: (error: Error) => void;
};

const deferredAgent = (): Deferred => {
  const handle: { reject: (error: Error) => void } = { reject: () => undefined };
  const promise = new Promise<AgentId>((_resolve, reject) => {
    handle.reject = reject;
  });
  return { promise, reject: (error) => handle.reject(error) };
};

describe('the failing check row carries its own work', () => {
  it('reads Starting on the row while Analyze is open, and a second click starts nothing', async () => {
    const pending = deferredAgent();
    const spawn = vi.spyOn(store.getState(), 'spawnAgent').mockReturnValue(pending.promise);
    const { row } = show({ phase: 'failing' });
    const analyze = within(row).getByRole('button', { name: 'Analyze' });

    fireEvent.click(analyze);
    fireEvent.click(analyze);

    await waitFor(() => expect(workStateOf({ row })).toBe('starting'));
    expect(analyze.getAttribute('aria-busy')).toBe('true');
    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    fireEvent.click(analyze);
    expect(spawn).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.reject(new Error('spawn failed'));
      await pending.promise.catch(() => undefined);
    });
    await waitFor(() => expect(workStateOf({ row })).toBeNull());
    expect(within(row).getByRole('button', { name: 'Analyze' }).getAttribute('aria-busy')).toBe(
      null,
    );
  });

  it('reads Analyzing with the step under the name, hides the duration, and stops from the row', () => {
    const cancelCurrentTurn = vi
      .spyOn(store.getState(), 'cancelCurrentTurn')
      .mockResolvedValue(undefined);
    const { seed, row } = show({ phase: 'running' });

    expect(workStateOf({ row })).toBe('analyzing');
    expect(row.querySelector('[data-item-work]')?.textContent).toContain(
      'Running the retry reproduction in ledger-core',
    );
    expect(durationOf({ row })).toBe('');
    expect(within(row).queryByRole('button', { name: 'Analyze' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Check fix status' })).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: 'Stop' }));
    expect(cancelCurrentTurn).toHaveBeenCalledWith(seed.sessionId, seed.agent.id, 'user');

    fireEvent.click(within(row).getByRole('button', { name: 'Open transcript' }));
    expect(store.getState().drawer).toMatchObject({
      kind: 'transcript',
      payload: { agentId: seed.agent.id },
    });
  });

  it('reads Cause found on the row once the Debugger proposed a fix', () => {
    const { row } = show({ phase: 'proposal' });

    expect(workStateOf({ row })).toBe('causeFound');
    expect(within(row).queryByRole('button', { name: 'Stop' })).toBeNull();
    expect(durationOf({ row })).toBe('1m 32s');
  });
});
