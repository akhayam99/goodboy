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

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the resolve scene pull request', () => {
  it('reads the byline with its number, branches and author', () => {
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });

    render(<PullRequestHeaderLine pr={RESOLVE_SCENE_PR} host="github" />);

    screen.getByText('nadia-p');
    screen.getByText(RESOLVE_SCENE_PR.baseBranch);
    screen.getByText(RESOLVE_SCENE_PR.headBranch);
  });
});
