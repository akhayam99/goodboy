// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { PullRequestState } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../test/sceneInvoke';
import { SESSION, seedResolveScene } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { BranchPage } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

type SeedParams = {
  readonly patch: Partial<PullRequestState>;
  readonly viewer: string | null;
};

const seedQuietRequest = ({ patch, viewer }: SeedParams): void => {
  seedResolveScene({ expandedThreadId: null });
  useAppStore.setState((state) => {
    const github = state.sessionGithub[SESSION.id];
    if (github === undefined || github.pr === null) {
      throw new Error('the scene has no pull request');
    }
    return {
      githubStatus: viewer === null ? null : { mode: 'gh-cli', available: true, user: viewer },
      sessionGithub: {
        ...state.sessionGithub,
        [SESSION.id]: { ...github, pr: { ...github.pr, ...patch } },
      },
      sessionResolveQueueItems: { ...state.sessionResolveQueueItems, [SESSION.id]: [] },
      sessionResolveThreads: { ...state.sessionResolveThreads, [SESSION.id]: [] },
    };
  });
};

const openPage = async (): Promise<void> => {
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
    </ToastProvider>,
  );
  await waitFor(() => expect(document.querySelector('[data-branch-pane]')).not.toBeNull());
};

const primaryId = (): string | null =>
  document.querySelector('[data-branch-primary]')?.getAttribute('data-branch-primary') ?? null;

describe('Branch page header', () => {
  it('holds the title row, one meta line and the page tabs, and no running line, work line or notice', async () => {
    seedQuietRequest({
      patch: { author: { login: 'nadia-p', avatarUrl: null } },
      viewer: 'harborline-dev',
    });

    await openPage();

    const header = document.querySelector<HTMLElement>('[data-page-header]');
    expect(header?.querySelectorAll('[data-slot="pane-title-row"]')).toHaveLength(1);
    expect(header?.querySelectorAll('[data-pr-header-line]')).toHaveLength(1);
    expect(header?.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    expect(header?.querySelector('[role="tablist"]')?.getAttribute('data-slot')).toBe('page-tabs');
    expect(header?.querySelector('[data-branch-running-line]')).toBeNull();
    expect(header?.querySelector('[data-testid="resolve-run-status"]')).toBeNull();
    expect(header?.querySelector('[role="alert"]')).toBeNull();
  });

  it('says Overview on the first tab and names the state in the title row', async () => {
    seedQuietRequest({ patch: { state: 'open', isDraft: false }, viewer: 'harborline-dev' });

    await openPage();

    const tabs = document.querySelectorAll('[role="tablist"] [role="tab"]');
    expect(tabs[0]?.textContent).toContain('Overview');
    expect(
      document.querySelector('[data-slot="pane-title-row"] [data-slot="branch-state"]')
        ?.textContent,
    ).toBe('Open');
  });
});

describe('Branch header on a pull request somebody else wrote', () => {
  it('reads Review when the signed in person is not the author', async () => {
    seedQuietRequest({
      patch: { author: { login: 'nadia-p', avatarUrl: null } },
      viewer: 'harborline-dev',
    });

    await openPage();

    await waitFor(() => expect(primaryId()).toBe('pullRequest.writeReview'));
    expect(document.querySelector('[data-branch-primary]')?.textContent).toBe('Review');
  });

  it('keeps the Review step away from the author', async () => {
    seedQuietRequest({
      patch: { author: { login: 'harborline-dev', avatarUrl: null } },
      viewer: 'harborline-dev',
    });

    await openPage();

    expect(primaryId()).not.toBe('pullRequest.writeReview');
  });

  it('assumes the branch is yours while the signed in person is unknown', async () => {
    seedQuietRequest({ patch: { author: { login: 'nadia-p', avatarUrl: null } }, viewer: null });

    await openPage();

    expect(primaryId()).not.toBe('pullRequest.writeReview');
  });
});
