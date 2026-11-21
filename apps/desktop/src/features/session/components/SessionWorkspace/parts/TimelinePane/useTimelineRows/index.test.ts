// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../../test/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../../test/storyHarness')).tauriEventModuleMock(),
);
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../../test/storyHarness';
import type { SessionEvent } from '@goodboy/types';
import { isoDateTimeOf, sessionEventIdOf } from '../../../../../../../__tests__/helpers/brandedIds';
import { SESSION, sessionFixture } from '../../../../../../../__tests__/helpers/actionFixtures';
import type { ExplodeGroups } from '../../../../../hooks/useExplodeGroups';
import type { TimelineStreamItem } from '../../../../../timeline/buildTimelineStream';
import { useTimelineRows } from './index';

type Harness = {
  entries: ReadonlyArray<unknown>;
};

const harness: Harness = vi.hoisted(() => ({ entries: [] }));

vi.mock('../../../../../central/useSessionWorkModel', () => ({
  useSessionWorkModel: () => ({
    entries: harness.entries,
    agents: [],
    worktrees: [],
    settledStopIds: new Set(),
    events: [],
    autoTrees: [],
    workflows: [],
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
    unreadAgentIds: new Set(),
    liveAgentIds: new Set(),
    owners: new Map(),
    resolveFactsByAgentId: new Map(),
    jobFactsByAgentId: new Map(),
    autoFactsByAgentId: new Map(),
    turnByAgentId: new Map(),
    isLoaded: true,
  }),
}));

vi.mock('../../../../../../../shared/hooks/useSessionRunHistory', () => ({
  useSessionRunHistory: () => new Map(),
}));

const EXPLODE: ExplodeGroups = {
  expandedIds: new Set(),
  leavingIds: new Set(),
  fullIds: new Set(),
  set: () => undefined,
  showAll: () => undefined,
  settle: () => undefined,
  keepOpen: () => undefined,
};

const eventEntry = (): unknown => {
  const at = new Date(2026, 10, 19, 22, 0, 0).toISOString();
  const event: SessionEvent = {
    id: sessionEventIdOf({ value: 'ev-one' }),
    sessionId: SESSION,
    kind: 'decisions_changed',
    payload: { added: 1 },
    createdAt: isoDateTimeOf({ value: at }),
  };
  return { kind: 'event', id: 'ev-one', at, event };
};

const dayLabelsOf = ({ items }: { readonly items: ReadonlyArray<TimelineStreamItem> }) =>
  items.flatMap((item) => (item.kind === 'day' ? [item.label] : []));

describe('useTimelineRows day labels', () => {
  beforeAll(async () => {
    await importStore();
  }, STORE_IMPORT_TIMEOUT_MS);

  beforeEach(async () => {
    await resetStoryStore();
    vi.useFakeTimers();
    harness.entries = [eventEntry()];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('relabels an idle session day rule once the clock passes midnight', () => {
    vi.setSystemTime(new Date(2026, 10, 20, 23, 59, 30));
    const { result } = renderHook(() =>
      useTimelineRows({
        session: sessionFixture(),
        view: 'log',
        query: '',
        explode: EXPLODE,
      }),
    );
    expect(dayLabelsOf({ items: result.current.stream.items })).toEqual(['Yesterday']);

    act(() => {
      vi.advanceTimersByTime(31_000);
    });

    expect(dayLabelsOf({ items: result.current.stream.items })).toEqual(['Thursday']);
  });
});
