// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { PullRequestState } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { SESSION, seedResolveScene } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { BranchPage } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

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
  await settle();
};

const primaryId = (): string | null =>
  document.querySelector('[data-branch-primary]')?.getAttribute('data-branch-primary') ?? null;

describe('Branch header on a pull request somebody else wrote', () => {
  it('reads Review when the signed in person is not the author', async () => {
    seedQuietRequest({ patch: { author: 'nadia-p' }, viewer: 'harborline-dev' });

    await openPage();

    expect(primaryId()).toBe('pullRequest.writeReview');
    expect(document.querySelector('[data-branch-primary]')?.textContent).toBe('Review');
  });

  it('keeps the Review step away from the author', async () => {
    seedQuietRequest({ patch: { author: 'harborline-dev' }, viewer: 'harborline-dev' });

    await openPage();

    expect(primaryId()).not.toBe('pullRequest.writeReview');
  });

  it('assumes the branch is yours while the signed in person is unknown', async () => {
    seedQuietRequest({ patch: { author: 'nadia-p' }, viewer: null });

    await openPage();

    expect(primaryId()).not.toBe('pullRequest.writeReview');
  });
});
