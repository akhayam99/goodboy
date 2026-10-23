// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../budget/budget', async () =>
  (await import('../../../store/storyHarness')).budgetModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { brandedId } from '../../history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { BOARD_PLACE, sessionPlace } from '../../../store/slices/navigation/place';
import { SessionCostChip } from '../../session/components/SessionOverviewPane/SessionCostChip';
import type { ActionEnv } from '../types';
import { SESSION_KIND } from './session';

let useAppStore: StoryStore;

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const OPEN_ID = brandedId<SessionId>({ value: 'session-ledger-core' });
const OTHER_ID = brandedId<SessionId>({ value: 'session-notify-relay' });
const THIRD_ID = brandedId<SessionId>({ value: 'session-payments-api' });

const SessionHost = () => {
  const sessionId = useAppStore((state) => state.currentSessionId);
  if (sessionId === null) {
    return null;
  }
  return (
    <div data-testid={`host-${sessionId}`}>
      <SessionCostChip key={`spend-${sessionId}`} sessionId={sessionId} placement="editHost" />
    </div>
  );
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID })],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [
      buildStorySession({ id: OPEN_ID, workspaceId: WORKSPACE_ID, goal: 'Ship ledger-core' }),
      buildStorySession({ id: OTHER_ID, workspaceId: WORKSPACE_ID, goal: 'Fix notify-relay' }),
      buildStorySession({ id: THIRD_ID, workspaceId: WORKSPACE_ID, goal: 'Tidy payments-api' }),
    ],
  });
});

afterEach(cleanup);

type GoParams = {
  readonly sessionId: SessionId | null;
};

const goTo = async ({ sessionId }: GoParams) => {
  await act(async () => {
    useAppStore.getState().navigate({
      to: sessionId === null ? BOARD_PLACE : sessionPlace({ sessionId }),
    });
  });
  await waitFor(() => expect(useAppStore.getState().currentSessionId).toBe(sessionId));
};

type SpendParams = {
  readonly sessionId: SessionId;
};

const chooseSpend = async ({ sessionId }: SpendParams) => {
  const facts = SESSION_KIND.facts({
    state: useAppStore.getState(),
    target: { kind: 'session', sessionId },
  });
  const action = SESSION_KIND.actions.find((entry) => entry.id === 'session.spend');
  if (facts === null || action === undefined) {
    throw new Error('no spend action');
  }
  const env: ActionEnv = {
    getState: () => useAppStore.getState(),
    showToast: vi.fn(),
    copyText: vi.fn(async () => undefined),
    origin: 'menu',
    anchorKey: `sidebar:${sessionId}`,
    viewing: null,
  };
  await act(async () => {
    await action.run({ facts, env, choice: null });
  });
};

const editorIn = ({ sessionId }: SpendParams) =>
  screen.queryByTestId(`host-${sessionId}`) === null
    ? null
    : screen.queryByLabelText('Limit in dollars');

describe('Spend and limit from a session menu', () => {
  it('opens the spend editor in place for the session on screen', async () => {
    render(<SessionHost />);
    await goTo({ sessionId: OPEN_ID });

    await chooseSpend({ sessionId: OPEN_ID });

    await waitFor(() => expect(editorIn({ sessionId: OPEN_ID })).not.toBeNull());
    expect(useAppStore.getState().currentSessionId).toBe(OPEN_ID);
  });

  it('opens another session with its spend editor open', async () => {
    render(<SessionHost />);
    await goTo({ sessionId: OPEN_ID });

    await chooseSpend({ sessionId: OTHER_ID });

    await waitFor(() => expect(useAppStore.getState().currentSessionId).toBe(OTHER_ID));
    await waitFor(() => expect(editorIn({ sessionId: OTHER_ID })).not.toBeNull());
  });

  it('opens the session from the workspace board with its spend editor open', async () => {
    render(<SessionHost />);
    await goTo({ sessionId: null });

    await chooseSpend({ sessionId: OTHER_ID });

    await waitFor(() => expect(useAppStore.getState().currentSessionId).toBe(OTHER_ID));
    await waitFor(() => expect(editorIn({ sessionId: OTHER_ID })).not.toBeNull());
  });

  it('never opens the request on another session', async () => {
    render(<SessionHost />);
    await goTo({ sessionId: OPEN_ID });
    await chooseSpend({ sessionId: OTHER_ID });
    await goTo({ sessionId: THIRD_ID });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(editorIn({ sessionId: THIRD_ID })).toBeNull();
  });

  it('drops the request when the person goes elsewhere before the session opens', async () => {
    await goTo({ sessionId: null });
    await chooseSpend({ sessionId: OTHER_ID });
    await goTo({ sessionId: THIRD_ID });
    await goTo({ sessionId: OTHER_ID });
    render(<SessionHost />);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(editorIn({ sessionId: OTHER_ID })).toBeNull();
  });
});
