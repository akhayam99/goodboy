// @vitest-environment happy-dom

const h = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { EXPLORE_ROOT_PATH, type ExploreListing } from '../../exploreRows';
import { useExploreListing } from './index';

type ProbeParams = {
  readonly sessionDir: string | null;
};

beforeEach(() => {
  h.invoke.mockReset();
  h.invoke.mockImplementation(() => new Promise(() => undefined));
});

afterEach(cleanup);

describe('useExploreListing', () => {
  it('never paints the missing folder error while the scratch folder resolves', () => {
    const frames: ExploreListing[] = [];
    const { rerender } = renderHook(
      ({ sessionDir }: ProbeParams) => {
        const controls = useExploreListing({ sessionDir });
        frames.push(controls.listing);
        return controls;
      },
      { initialProps: { sessionDir: null } as ProbeParams },
    );

    rerender({ sessionDir: '/work/cascadia-scratch' });

    expect(frames.length).toBeGreaterThan(1);
    expect(frames.every((frame) => frame.errorByPath[EXPLORE_ROOT_PATH] == null)).toBe(true);
    expect(frames.at(-1)?.loadingByPath[EXPLORE_ROOT_PATH]).toBe(true);
  });

  it('keeps the error for a folder path that is empty', () => {
    const { result } = renderHook(() => useExploreListing({ sessionDir: '' }));

    expect(result.current.listing.errorByPath[EXPLORE_ROOT_PATH]).toBe(
      'Session folder is not available yet.',
    );
  });
});
