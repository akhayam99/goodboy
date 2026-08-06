// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  seenVersion: null as string | null,
  installedVersion: null as string | null,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (state: { changelogSeenVersion: string | null }) => T) =>
    selector({ changelogSeenVersion: mocks.seenVersion }),
}));

vi.mock('../useInstalledVersion', () => ({
  useInstalledVersion: () => mocks.installedVersion,
}));

import { useUnseenRelease } from './index';

beforeEach(() => {
  mocks.seenVersion = null;
  mocks.installedVersion = null;
});

describe('useUnseenRelease', () => {
  it('says nothing is unseen while the running version is unknown', () => {
    mocks.seenVersion = null;

    expect(renderHook(() => useUnseenRelease()).result.current).toBe(false);
  });

  it('flags the running version when its notes were never opened', () => {
    mocks.installedVersion = '0.1.66';

    expect(renderHook(() => useUnseenRelease()).result.current).toBe(true);
  });

  it('clears once the running version is the one marked as read, tag prefix aside', () => {
    mocks.installedVersion = '0.1.66';
    mocks.seenVersion = 'v0.1.66';

    expect(renderHook(() => useUnseenRelease()).result.current).toBe(false);
  });

  it('flags again after an update moves past the version that was read', () => {
    mocks.installedVersion = '0.1.67';
    mocks.seenVersion = '0.1.66';

    expect(renderHook(() => useUnseenRelease()).result.current).toBe(true);
  });
});
