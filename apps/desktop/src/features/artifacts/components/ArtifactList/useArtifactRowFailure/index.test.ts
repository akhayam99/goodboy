// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import type { ReportErrorParams } from '../../../../../store/slices/notifications/reportError';

const reportError = vi.fn(async (_params: ReportErrorParams) => undefined);

let useAppStore: StoryStore;
let useArtifactRowFailure: typeof import('./index').useArtifactRowFailure;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ useArtifactRowFailure } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION = brandId<SessionId>({ value: 'session-1' });

type FailureParams = {
  readonly actionId: string | null;
};

const failureOf = ({ actionId }: FailureParams) => {
  const retry = vi.fn();
  const dismissFailure = vi.fn();
  return {
    failure: actionId === null ? null : { actionId, error: new Error('the plan moved') },
    retry,
    dismissFailure,
  };
};

beforeEach(async () => {
  await resetStoryStore();
  reportError.mockClear();
  useAppStore.setState({ reportError });
});

afterEach(cleanup);

describe('useArtifactRowFailure', () => {
  it('logs a failed row action once, names the artifact, and clears the row', () => {
    const given = failureOf({ actionId: 'artifact.runPlan' });

    renderHook(() =>
      useArtifactRowFailure({ ...given, title: 'Retry-safe webhook credits', sessionId: SESSION }),
    );

    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError.mock.calls[0]?.[0]).toMatchObject({
      title: "Couldn't run Retry-safe webhook credits",
      sessionId: SESSION,
    });
    expect(given.dismissFailure).toHaveBeenCalledOnce();
  });

  it('hands Retry the same action again', async () => {
    const given = failureOf({ actionId: 'artifact.restore' });
    renderHook(() =>
      useArtifactRowFailure({ ...given, title: 'Cascadia plan', sessionId: SESSION }),
    );

    const reported = reportError.mock.calls[0]?.[0];
    expect(reported?.title).toBe("Couldn't restore Cascadia plan");
    expect(await reported?.retry?.()).toBe(true);
    expect(given.retry).toHaveBeenCalledOnce();
  });

  it('logs nothing while no action failed', () => {
    const given = failureOf({ actionId: null });

    renderHook(() =>
      useArtifactRowFailure({ ...given, title: 'Cascadia plan', sessionId: SESSION }),
    );

    expect(reportError).not.toHaveBeenCalled();
    expect(given.dismissFailure).not.toHaveBeenCalled();
  });
});
