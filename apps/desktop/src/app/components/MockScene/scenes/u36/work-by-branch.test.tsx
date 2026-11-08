// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { registerMockFixtures } from '../../../../../shared/lib/mockFixtures';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { mockArtifactProvenance, mockMountDiffStat } from '../../mockFixtureData';
import { U36_WORK_BY_BRANCH_SCENES } from './work-by-branch';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U36_WORK_BY_BRANCH_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  registerMockFixtures({
    readers: { mountDiffStat: mockMountDiffStat, artifactProvenance: mockArtifactProvenance },
  });
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'db_select') {
      return Promise.resolve([]);
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  registerMockFixtures({
    readers: { mountDiffStat: () => null, artifactProvenance: () => null },
  });
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U36_WORK_BY_BRANCH_SCENES[name];
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

const headingTexts = (): ReadonlyArray<string | null> =>
  screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

describe('the u36 work by branch scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U36_WORK_BY_BRANCH_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('u36-c19-questions-by-branch groups the questions under their branches and No branch', async () => {
    await mount('u36-c19-questions-by-branch');

    const headings = headingTexts();
    expect(headings).toContain('fix/duplicate-credit');
    expect(headings).toContain('feat/retry-budget');
    expect(headings).toContain('rec/2-backfill');
    expect(headings[headings.length - 1]).toBe('No branch');
    expect(screen.getAllByRole('button', { name: /^Should the limit apply/ })).toHaveLength(2);
    expect(screen.getAllByTestId('run-also-on')).toHaveLength(2);
  });

  it('u36-c19-artifacts-by-branch groups the artifacts, with the trash last', async () => {
    await mount('u36-c19-artifacts-by-branch');

    const headings = headingTexts().map((heading) => heading ?? '');
    expect(headings.some((heading) => heading.startsWith('fix/duplicate-credit'))).toBe(true);
    expect(headings.some((heading) => heading.startsWith('No branch'))).toBe(true);
    expect(headings[headings.length - 1]).toMatch(/^Recently deleted/);
    expect(
      screen.getAllByRole('button', { name: /^Report Retried webhooks no longer double credit/ }),
    ).toHaveLength(2);
  });

  it('u36-c19-branch-links counts the run that holds the waiting questions once on the Work tab, with no line under the tabs', async () => {
    await mount('u36-c19-branch-links');

    expect(document.querySelector('[data-branch-runs-line]')).toBeNull();
    const strip = screen.getByRole('tablist', { name: 'Branch pages' });
    const work = within(strip).getByRole('tab', { name: /^Work/ });
    expect(work.querySelector('[data-tab-count]')?.textContent).toBe('1');
  });
});
