// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PrCheckRun } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { checksAnalyzeSeed } from '../../../../app/components/MockScene/scenes/u24/checksAnalyzeSeed';
import { BranchChecks } from '../BranchChecks';

let store: StoryStore;

type GhParams = {
  readonly exitCode: number;
};

const answerGh = ({ exitCode }: GhParams) =>
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'gh_run') {
      return Promise.resolve({
        stdout: 'FAIL src/ledger.test.ts\nExpected credits: 1\nReceived credits: 2',
        stderr: '',
        exitCode,
      });
    }
    return sceneInvoke({ command, args });
  });

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  answerGh({ exitCode: 0 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type UrlParams = {
  readonly detailsUrl: string;
};

const show = () => {
  const seed = checksAnalyzeSeed({ phase: 'failing' });
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

const moveCheckTo = ({ detailsUrl }: UrlParams) => {
  const seed = checksAnalyzeSeed({ phase: 'failing' });
  const moved: PrCheckRun = { ...seed.check, detailsUrl };
  store.setState((state) => {
    const mount = state.mountGithub[seed.repo.mountId];
    const session = state.sessionGithub[seed.sessionId];
    if (mount?.detail == null || session?.detail == null) {
      throw new Error('The checks scene needs the pull request detail.');
    }
    return {
      mountGithub: {
        ...state.mountGithub,
        [seed.repo.mountId]: { ...mount, detail: { ...mount.detail, checks: [moved] } },
      },
      sessionGithub: {
        ...state.sessionGithub,
        [seed.sessionId]: { ...session, detail: { ...session.detail, checks: [moved] } },
      },
      checkLogs: {},
    };
  });
  render(
    <ToastProvider>
      <BranchChecks sessionId={seed.sessionId} />
    </ToastProvider>,
  );
  const row = document.querySelector<HTMLElement>(`[data-check-row="${seed.check.name}"]`);
  if (row === null) {
    throw new Error('The failing check row is missing');
  }
  return row;
};

type RowParams = {
  readonly row: HTMLElement;
};

const rowButtonOf = ({ row }: RowParams): HTMLElement => {
  const button = row.querySelector<HTMLElement>('button');
  if (button === null) {
    throw new Error('The check row must be a button.');
  }
  return button;
};

describe('the failing check row reads its log in place', () => {
  it('shows the log of the first failing check from gh, with Open on GitHub and Analyze', async () => {
    const { row } = show();

    await waitFor(() =>
      expect(row.querySelector('[data-check-log] pre')?.textContent).toContain(
        'Received credits: 2',
      ),
    );
    within(row).getByRole('button', { name: 'Open on GitHub' });
    within(row).getByRole('button', { name: 'Analyze' });
    const ghCalls = storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'gh_run');
    expect(ghCalls.length).toBe(1);
  });

  it('hides the log on a click of the row and reads it again on the next one', async () => {
    const { row } = show();
    await waitFor(() => expect(row.querySelector('[data-check-log] pre')).not.toBeNull());

    fireEvent.click(rowButtonOf({ row }));
    expect(row.querySelector('[data-check-log]')).toBeNull();

    fireEvent.click(rowButtonOf({ row }));
    expect(row.querySelector('[data-check-log] pre')?.textContent).toContain('Received credits');
  });

  it('says GitHub gave no log when gh refuses, and keeps the way to the host', async () => {
    answerGh({ exitCode: 1 });
    const { row } = show();

    await waitFor(() =>
      expect(row.querySelector('[data-check-log]')?.textContent).toContain(
        'GitHub gave no log for this check.',
      ),
    );
    within(row).getByRole('button', { name: 'Open on GitHub' });
  });

  it('leaves a check that is not a GitHub Actions job to its host, with no log and no gh call', () => {
    const row = moveCheckTo({ detailsUrl: 'https://ci.northwind.dev/jobs/42' });

    fireEvent.click(rowButtonOf({ row }));

    expect(row.querySelector('[data-check-log]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open on GitHub' })).toBeNull();
    expect(storySpies.tauriInvoke.mock.calls.some(([command]) => command === 'gh_run')).toBe(false);
  });
});
