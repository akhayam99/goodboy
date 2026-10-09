// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { seedResolveGitlabScene } from '../../../app/components/MockScene/scenes/resolveGitlabSeed';
import { SESSION_ID } from '../../../app/components/MockScene/scenes/resolveSeed';
import { useReviewTally } from '../useReviewTally';
import { useFixableThreadIds } from '.';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const readOnce = <T>(hook: () => T): T => {
  const { result, unmount } = renderHook(hook);
  const value = result.current;
  unmount();
  return value;
};

const fixableAndTally = () => ({
  ids: readOnce(() => useFixableThreadIds({ sessionId: SESSION_ID })),
  tally: readOnce(() => useReviewTally({ sessionId: SESSION_ID })),
});

describe('useFixableThreadIds', () => {
  it('lists the comments Fix N would take on the selected GitLab merge request', () => {
    seedResolveGitlabScene({ selected: 'gitlab' });

    const { ids, tally } = fixableAndTally();

    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toHaveLength(tally.fixable);
    expect(ids.every((id) => id.startsWith('gitlab:'))).toBe(true);
  });

  it('counts the same comments on the GitHub source, never the other host', () => {
    seedResolveGitlabScene({ selected: 'github' });

    const { ids, tally } = fixableAndTally();

    expect(ids).toHaveLength(tally.fixable);
    expect(ids.every((id) => id.startsWith('PRRT_'))).toBe(true);
  });
});
