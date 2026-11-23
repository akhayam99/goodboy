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
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PaneSwap } from '@goodboy/ui';
import { brandId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  failedState,
  harborline,
  ledgerCore,
  prepareBoard,
  runningState,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';
import { StageBoard } from '../StageBoard';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T10:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const webhook = sessionOf({
  goal: 'Fix webhook retries',
  state: runningState(),
  updatedAt: '2026-10-06T09:55:00.000Z',
  lastOpenedAt: '2026-10-06T08:00:00.000Z',
});
const WEBHOOK_ID = brandId<SessionId>({ value: webhook.id });
const retry = sessionOf({
  goal: 'Retry policy for 429s',
  updatedAt: '2026-10-06T09:48:00.000Z',
  lastOpenedAt: '2026-10-06T09:00:00.000Z',
});

const MainPanes = () => {
  const sessions = useAppStore((state) => state.sessions);
  const sessionId = useAppStore((state) => state.currentSessionId);
  return (
    <PaneSwap
      activeKey={sessionId === null ? 'board' : 'session'}
      layers={[
        {
          key: 'board',
          content: <StageBoard workspaceId={harborline.id} sessions={sessions} />,
        },
        { key: 'session', content: <section aria-label="Session pane" /> },
      ]}
    />
  );
};

const mount = () => {
  seedColumn({
    store: useAppStore,
    sessions: [webhook, retry],
    mounts: [[webhook, ledgerCore]],
  });
  prepareBoard({ store: useAppStore });
  return render(
    <ToastProvider>
      <button type="button">Tasks</button>
      <MainPanes />
    </ToastProvider>,
  );
};

const rest = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const buttonOf = (title: string): HTMLElement => screen.getByRole('button', { name: title });

const rowOf = (title: string): HTMLElement => {
  const row = buttonOf(title).closest('article');
  if (row === null) {
    throw new Error(`no board card for ${title}`);
  }
  return row;
};

const card = () => screen.queryByTestId('session-hover-card');

const openOn = (title: string) => {
  fireEvent.mouseEnter(rowOf(title));
  rest(500);
  expect(card()).not.toBeNull();
};

const showSession = (sessionId: SessionId | null) => {
  act(() => {
    useAppStore.setState({ currentSessionId: sessionId });
  });
  rest(1000);
};

describe('the hover card never sticks', () => {
  it('stays shut when the rail brings the board back after a session hid it with the card open', () => {
    mount();
    openOn('Fix webhook retries');

    showSession(WEBHOOK_ID);
    showSession(null);

    expect(card()).toBeNull();
  });

  it('stays shut when the session it showed moved lane while the board was hidden', () => {
    mount();
    openOn('Fix webhook retries');

    showSession(WEBHOOK_ID);
    act(() => {
      useAppStore.setState((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === webhook.id ? { ...session, state: failedState() } : session,
        ),
      }));
    });
    showSession(null);

    expect(card()).toBeNull();
  });

  it('closes on a click outside the card, on a rail item', () => {
    mount();
    openOn('Fix webhook retries');

    fireEvent.pointerDown(buttonOf('Tasks'));

    expect(card()).toBeNull();
  });

  it('stays open on a click inside the card', () => {
    mount();
    openOn('Fix webhook retries');
    const open = screen.getByTestId('session-hover-card');

    fireEvent.pointerDown(open);

    expect(card()).not.toBeNull();
  });

  it('closes when a page opens over the board', () => {
    mount();
    openOn('Fix webhook retries');

    act(() => {
      useAppStore.getState().openStudio({ studio: { kind: 'monitoring' } });
    });

    expect(card()).toBeNull();
  });

  it('closes on Escape', () => {
    mount();
    openOn('Fix webhook retries');

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(card()).toBeNull();
  });

  it('closes a moment after the pointer leaves without entering the card', () => {
    mount();
    openOn('Fix webhook retries');

    fireEvent.mouseLeave(rowOf('Fix webhook retries'));
    rest(200);

    expect(card()).toBeNull();
  });

  it('closes when the keyboard focus leaves the card title', () => {
    mount();
    act(() => buttonOf('Fix webhook retries').focus());
    rest(500);
    expect(card()).not.toBeNull();

    act(() => buttonOf('Fix webhook retries').blur());
    rest(200);

    expect(card()).toBeNull();
  });

  it('does not open on a focus that did not come from the keyboard', () => {
    mount();
    const realMatches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function matches(
      this: Element,
      selector: string,
    ) {
      return selector === ':focus-visible' ? false : realMatches.call(this, selector);
    });

    act(() => buttonOf('Fix webhook retries').focus());
    rest(1000);

    expect(card()).toBeNull();
  });
});
