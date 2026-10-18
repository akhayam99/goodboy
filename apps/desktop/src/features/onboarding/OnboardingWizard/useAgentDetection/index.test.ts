// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useAgentDetection } from './index';

let useAppStore: StoryStore;

type Deferred = {
  readonly promise: Promise<unknown>;
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
};

const deferred = (): Deferred => {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

type StatusParams = {
  readonly id: string;
  readonly binary: string;
  readonly version: string | null;
};

const found = ({ id, binary, version }: StatusParams) => ({
  id,
  binary,
  available: version !== null,
  version,
  error: version === null ? 'not found' : null,
  errorKind: version === null ? 'notFound' : null,
});

const STEADY = {
  refresh_provider_status: found({ id: 'anthropic', binary: 'claude', version: '2.1.280' }),
  refresh_cursor_status: found({ id: 'cursor', binary: 'cursor-agent', version: null }),
  refresh_gemini_status: found({ id: 'gemini', binary: 'agy', version: null }),
  check_provider_auth: { state: 'connected', identity: 'dana@northwind.dev' },
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('useAgentDetection', () => {
  it('drops a late result for an older check of the same agent', async () => {
    const answers = [deferred(), deferred()];
    let calls = 0;
    stubStoryInvoke({
      ...STEADY,
      refresh_codex_status: () => {
        const answer = answers[calls] ?? deferred();
        calls += 1;
        return answer.promise;
      },
    });
    const seen: Array<string | null> = [];
    const stop = useAppStore.subscribe((state) => seen.push(state.codexStatus?.version ?? null));

    const { result } = renderHook(() => useAgentDetection());
    await waitFor(() => expect(calls).toBe(1));
    act(() => result.current.checkNow());

    await act(async () => {
      answers[0]?.resolve(found({ id: 'codex', binary: 'codex', version: 'codex-cli 0.61.0' }));
    });
    await waitFor(() => expect(calls).toBe(2));
    await act(async () => {
      answers[1]?.resolve(found({ id: 'codex', binary: 'codex', version: 'codex-cli 0.62.0' }));
    });

    await waitFor(() =>
      expect(useAppStore.getState().codexStatus?.version).toBe('codex-cli 0.62.0'),
    );
    expect(seen).not.toContain('codex-cli 0.61.0');
    expect(result.current.checks.codex.isChecking).toBe(false);
    stop();
  });

  it("says it couldn't check and keeps the last known state", async () => {
    stubStoryInvoke({
      ...STEADY,
      refresh_codex_status: found({ id: 'codex', binary: 'codex', version: 'codex-cli 0.62.0' }),
    });
    const { result } = renderHook(() => useAgentDetection());
    await waitFor(() =>
      expect(useAppStore.getState().codexStatus?.version).toBe('codex-cli 0.62.0'),
    );

    stubStoryInvoke({
      ...STEADY,
      refresh_codex_status: async () => {
        throw new Error('the login shell timed out');
      },
    });
    act(() => result.current.check({ providerId: 'codex' }));

    await waitFor(() =>
      expect(result.current.checks.codex.failure).toContain('the login shell timed out'),
    );
    expect(useAppStore.getState().codexStatus?.version).toBe('codex-cli 0.62.0');
  });

  it('checks again when the window comes back into focus', async () => {
    let calls = 0;
    stubStoryInvoke({
      ...STEADY,
      refresh_codex_status: () => {
        calls += 1;
        return found({ id: 'codex', binary: 'codex', version: 'codex-cli 0.62.0' });
      },
    });
    renderHook(() => useAgentDetection());
    await waitFor(() => expect(calls).toBe(1));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(calls).toBe(2));
  });
});
