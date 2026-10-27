// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  harborline,
  ledgerCore,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../testing/sessionColumn';
import { useNeedsYouElsewhere } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const inPayments = sessionOf({ goal: 'Question in payments-api' });
const inLedger = sessionOf({ goal: 'Question in ledger-core' });
const otherLedger = sessionOf({ goal: 'Another question in ledger-core' });

const seed = () =>
  seedColumn({
    store: useAppStore,
    sessions: [inPayments, inLedger, otherLedger],
    questions: [inPayments, inLedger, otherLedger],
    mounts: [
      [inPayments, paymentsApi],
      [inLedger, ledgerCore],
      [otherLedger, ledgerCore],
    ],
  });

const render = () =>
  renderHook(() =>
    useNeedsYouElsewhere({
      workspaceId: harborline.id,
      sessions: useAppStore((state) => state.sessions),
    }),
  );

describe('useNeedsYouElsewhere', () => {
  it('is zero with no project filter, since nothing is hidden', () => {
    seed();

    expect(render().result.current).toBe(0);
  });

  it('counts the sessions that need you in the projects the filter leaves out', () => {
    seed();
    act(() => {
      useAppStore.getState().setSelectedProjectIds({
        workspaceId: harborline.id,
        selectedProjectIds: [paymentsApi.id],
      });
    });

    expect(render().result.current).toBe(2);
  });

  it('falls to zero once the question in the other project is answered', () => {
    seed();
    act(() => {
      useAppStore.getState().setSelectedProjectIds({
        workspaceId: harborline.id,
        selectedProjectIds: [paymentsApi.id],
      });
    });
    const { result } = render();
    act(() => {
      useAppStore.setState({
        sessionOpenQuestions: Object.fromEntries(
          Object.entries(useAppStore.getState().sessionOpenQuestions).filter(
            ([id]) => id === inPayments.id,
          ),
        ),
      });
    });

    expect(result.current).toBe(0);
  });
});
