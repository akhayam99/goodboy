// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { PullRequestHeaderLine } from '../../../../features/branch/components/PullRequestTab/PullRequestHeaderLine';
import { EXPANDED_THREAD_ID, RESOLVE_SCENE_PR, SESSION_ID, seedResolveScene } from './resolveSeed';

let store: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the resolve scene pull request', () => {
  it('reads the byline with its author and commit count', async () => {
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
    const entries = Object.values(store.getState().pullRequestViews[SESSION_ID] ?? {});
    const commitCount = entries[0]?.view?.commits.length ?? null;

    render(<PullRequestHeaderLine pr={RESOLVE_SCENE_PR} host="github" commitCount={commitCount} />);

    screen.getByText('nadia-p wants to merge 2 commits into');
  });
});
