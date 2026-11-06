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
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useSessionWorkLoads } from '.';

const FIRST = brandId<SessionId>({ value: 'session-northwind' });
const SECOND = brandId<SessionId>({ value: 'session-cascadia' });

let useAppStore: StoryStore;

const loads = {
  events: vi.fn(async () => undefined),
  artifacts: vi.fn(async () => undefined),
  context: vi.fn(async () => undefined),
  open: vi.fn(async () => undefined),
  answered: vi.fn(async () => undefined),
  dismissed: vi.fn(async () => undefined),
};

const flagUndeliveredAnswers = vi.fn(() => undefined);

const settle = () => act(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  for (const load of Object.values(loads)) {
    load.mockClear();
  }
  flagUndeliveredAnswers.mockClear();
  useAppStore.setState({
    loadSessionEvents: loads.events,
    loadSessionArtifacts: loads.artifacts,
    loadSessionContextItems: loads.context,
    loadSessionOpenQuestions: loads.open,
    loadSessionAnsweredQuestions: loads.answered,
    loadSessionDismissedQuestions: loads.dismissed,
    flagUndeliveredAnswers,
    sessionPhaseRuns: { [FIRST]: [] },
  });
});

afterEach(cleanup);

describe('useSessionWorkLoads', () => {
  it('runs one set of loads for two consumers of the same session', () => {
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));

    expect(loads.events).toHaveBeenCalledTimes(1);
    expect(loads.artifacts).toHaveBeenCalledTimes(1);
    expect(loads.context).toHaveBeenCalledTimes(1);
    expect(loads.answered).toHaveBeenCalledTimes(1);
    expect(loads.dismissed).toHaveBeenCalledTimes(1);
  });

  it('loads each session once', () => {
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    renderHook(() => useSessionWorkLoads({ sessionId: SECOND }));

    expect(loads.events).toHaveBeenCalledTimes(2);
    expect(loads.events).toHaveBeenCalledWith({ sessionId: SECOND });
  });

  it('loads again when the last consumer left and one comes back', () => {
    const first = renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    first.unmount();
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));

    expect(loads.events).toHaveBeenCalledTimes(2);
  });

  it('keeps the loads quiet while one consumer is still mounted', () => {
    const first = renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    first.unmount();
    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));

    expect(loads.events).toHaveBeenCalledTimes(1);
  });

  it('flags undelivered answers once, after the open questions landed too', async () => {
    let finishOpen: () => void = () => undefined;
    loads.open.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finishOpen = () => resolve(undefined);
        }),
    );

    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    await settle();
    expect(flagUndeliveredAnswers).not.toHaveBeenCalled();

    finishOpen();
    await settle();

    expect(flagUndeliveredAnswers).toHaveBeenCalledExactlyOnceWith({ sessionId: FIRST });
  });

  it('waits for the asking agents when they land after the questions', async () => {
    useAppStore.setState({ sessionPhaseRuns: {} });

    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    await settle();
    expect(flagUndeliveredAnswers).not.toHaveBeenCalled();

    act(() => useAppStore.setState({ sessionPhaseRuns: { [FIRST]: [] } }));

    expect(flagUndeliveredAnswers).toHaveBeenCalledExactlyOnceWith({ sessionId: FIRST });
  });

  it('keeps open questions that are already in the store', async () => {
    useAppStore.setState({ sessionOpenQuestions: { [FIRST]: [] } });

    renderHook(() => useSessionWorkLoads({ sessionId: FIRST }));
    await settle();

    expect(loads.open).not.toHaveBeenCalled();
    expect(flagUndeliveredAnswers).toHaveBeenCalledOnce();
  });

  it('drops the late load of a session the page has left', async () => {
    let finishAnswered: () => void = () => undefined;
    loads.answered.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finishAnswered = () => resolve(undefined);
        }),
    );
    useAppStore.setState({ sessionPhaseRuns: { [FIRST]: [], [SECOND]: [] } });
    const page = renderHook(({ sessionId }) => useSessionWorkLoads({ sessionId }), {
      initialProps: { sessionId: FIRST },
    });

    page.rerender({ sessionId: SECOND });
    await settle();
    finishAnswered();
    await settle();

    expect(flagUndeliveredAnswers).toHaveBeenCalledExactlyOnceWith({ sessionId: SECOND });
  });
});
