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
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type Session,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  harborline,
  seedColumn,
  sessionOf,
} from '../../../../features/workspace/testing/sessionColumn';
import { BOARD_PLACE, sessionPlace } from '../../../../store/slices/navigation/place';
import {
  EMPTY_FOCUS,
  type Location,
  type Place,
  type SessionTarget,
} from '../../../../store/slices/navigation/types';
import type { LensKind } from '../../../../store/slices/session-view/types';
import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { NavCluster } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const RETRY = sessionOf({ goal: 'Retry failed webhook deliveries' });

type PlaceParams = {
  readonly place: Place;
};

const locationOf = ({ place }: PlaceParams): Location => ({
  workspaceId: harborline.id,
  place,
  studio: null,
  focus: EMPTY_FOCUS,
});

const BOARD_ENTRY = locationOf({ place: BOARD_PLACE });

type ViewParams = {
  readonly sessionId: SessionId;
  readonly lens: LensKind | null;
  readonly agentId?: AgentId | null;
  readonly target?: SessionTarget | null;
};

const sessionView = (params: ViewParams): Location => locationOf({ place: sessionPlace(params) });

type SeedParams = {
  readonly sessions?: ReadonlyArray<Session>;
  readonly entries: ReadonlyArray<Location>;
  readonly index: number;
};

const seed = ({ sessions = [RETRY], entries, index }: SeedParams) => {
  seedColumn({ store: useAppStore, sessions });
  useAppStore.setState({ navigation: { [harborline.id]: { entries: [...entries], index } } });
};

const indexNow = (): number | undefined => useAppStore.getState().navigation[harborline.id]?.index;

describe('NavCluster', () => {
  it('disables Back with nothing behind, and names the destination when there is one', () => {
    seed({ entries: [BOARD_ENTRY], index: 0 });
    render(<NavCluster />);
    const back = screen.getByRole('button', { name: 'Back' });
    expect(back.getAttribute('aria-disabled')).toBe('true');
    expect(tooltipTextOf({ element: back })).toBe('Nothing to go back to');
    fireEvent.click(back);
    expect(indexNow()).toBe(0);

    cleanup();
    seed({
      entries: [sessionView({ sessionId: RETRY.id, lens: 'review' }), BOARD_ENTRY],
      index: 1,
    });
    render(<NavCluster />);
    const live = screen.getByRole('button', { name: 'Back: Comments' });
    expect(tooltipTextOf({ element: live })).toContain('Retry failed webhook deliveries');
    expect(tooltipTextOf({ element: live })).toContain('Hold for history');
    fireEvent.click(live);

    expect(indexNow()).toBe(0);
    expect(useAppStore.getState().currentSessionId).toBe(RETRY.id);
  });

  it('names the agent and the run an entry shows, even from another session', () => {
    const OTHER_ID = brandId<SessionId>({ value: 'session-guard' });
    const withRun = aSession({
      workspaceId: harborline.id,
      goal: 'Retry failed webhook deliveries',
      workflowRuns: [
        aWorkflowRun({
          id: brandId<WorkflowRunId>({ value: 'run-relay' }),
          title: 'Retry the relay on 503',
        }),
      ],
    });
    const other = aSession({
      id: OTHER_ID,
      workspaceId: harborline.id,
      goal: 'Guard the settlement batch',
      workflowRuns: [],
    });
    const sessionId = withRun.id;
    const testerId = brandId<AgentId>({ value: 'agent-tester' });
    seed({
      sessions: [withRun, other],
      entries: [
        sessionView({
          sessionId,
          lens: 'workflows',
          target: { kind: 'run', runId: 'run-relay' },
        }),
        sessionView({ sessionId, lens: 'workflows', agentId: testerId }),
        sessionView({ sessionId: OTHER_ID, lens: null }),
      ],
      index: 2,
    });
    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [anAgent({ id: testerId, name: 'Tester', kind: 'tester' })],
      },
    });
    render(<NavCluster />);

    const back = screen.getByRole('button', { name: /^Back: / });
    expect(back.getAttribute('aria-label')).toBe('Back: Tester');
    expect(tooltipTextOf({ element: back })).toContain('Retry failed webhook deliveries');
    fireEvent.contextMenu(back);
    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'OverviewGuard the settlement batch',
      'TesterRetry failed webhook deliveries',
      'Retry the relay on 503Retry failed webhook deliveries',
    ]);
  });

  it('opens the recent history on right click and jumps to an entry', () => {
    const sessionId = RETRY.id;
    seed({
      entries: [
        sessionView({ sessionId, lens: null }),
        sessionView({ sessionId, lens: 'review' }),
        BOARD_ENTRY,
      ],
      index: 2,
    });
    render(<NavCluster />);

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Back: Comments' }));
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual([
      'Board',
      'CommentsRetry failed webhook deliveries',
      'OverviewRetry failed webhook deliveries',
    ]);
    expect(items[0]?.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(items[2] ?? document.body);

    expect(indexNow()).toBe(0);
  });
});
