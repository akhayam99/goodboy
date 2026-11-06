// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { stubStoryInvoke } from '../../../../store/storyHarness';
import { EXPLORE_ROOT_PATH, type ExploreListing } from '../../exploreRows';
import { useExploreListing } from './index';

type ProbeParams = {
  readonly sessionDir: string | null;
};

beforeEach(() => {
  stubStoryInvoke({ explore_list: [] });
});

afterEach(cleanup);

describe('useExploreListing', () => {
  it('never paints the missing folder error while the scratch folder resolves', () => {
    const frames: ExploreListing[] = [];
    const initialProps: ProbeParams = { sessionDir: null };
    const { rerender } = renderHook(
      ({ sessionDir }: ProbeParams) => {
        const controls = useExploreListing({ sessionDir });
        frames.push(controls.listing);
        return controls;
      },
      { initialProps },
    );

    rerender({ sessionDir: '/work/cascadia-scratch' });

    expect(frames.length).toBeGreaterThan(1);
    expect(frames.every((frame) => frame.errorByPath[EXPLORE_ROOT_PATH] == null)).toBe(true);
  });

  it('keeps the error for a folder path that is empty', () => {
    const { result } = renderHook(() => useExploreListing({ sessionDir: '' }));

    expect(result.current.listing.errorByPath[EXPLORE_ROOT_PATH]).toBe(
      'Session folder is not available yet.',
    );
  });
});
