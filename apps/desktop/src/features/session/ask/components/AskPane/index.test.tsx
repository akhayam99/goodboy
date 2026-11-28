// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({
    listAskThreads: async () => [],
  }),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { selectIsAskOpen } from '../../../../../store/slices/ask/selectIsAskOpen';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type SessionId,
  type ChatId,
  type ChatMessage,
  type ChatMessageId,
  type IsoDateTime,
  type ProviderRunId,
} from '@goodboy/types';
import type { LensKind } from '../../../../../store';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { selectDetailDrawer } from '../../../../../store/slices/drawer/selectDetailDrawer';
import { selectGridTool } from '../../../../../store/slices/drawer/selectGridTool';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { pressShortcut } from '../../../../../__tests__/helpers/pressKey';
import { SessionHead } from '../../../../../app/components/SessionHead';
import {
  FLOW_SESSION,
  FLOW_SESSION_ID,
  NOW,
  SESSIONS,
} from '../../../../../app/components/MockScene/scenes/flow-audit/fixtures';
import { seedShellChrome } from '../../../../../app/components/MockScene/scenes/shellChrome';
import { seedWorkflowRun } from '../../../../../app/components/MockScene/scenes/flow-audit/seeds';
import { SessionWorkspace } from '../../../components/SessionWorkspace';
import { AskPane } from '.';
import { SessionHeadContext } from '../../../sessionHeadContext';

const THREAD_ID = brandId<ChatId>({ value: 'thread-pane-credit' });

const ANSWER_ID = brandId<ChatMessageId>({ value: 'pane-a1' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  seedWorkflowRun();
  seedShellChrome({
    session: FLOW_SESSION,
    siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION.id),
    branches: {},
    telemetryAt: NOW,
    lens: null,
  });
  useAppStore.setState({
    currentWorkspaceId: FLOW_SESSION.workspaceId,
    currentSessionId: FLOW_SESSION_ID,
    selectedAgentId: {},
    sessionProjectMounts: {},
    navigate: useAppStore.getInitialState().navigate,
  });
});

afterEach(async () => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  cleanup();
  vi.unstubAllGlobals();
});

const renderWorkspace = () =>
  render(
    <ToastProvider>
      <SessionHeadContext.Provider value={SessionHead}>
        <SessionWorkspace session={FLOW_SESSION} />
      </SessionHeadContext.Provider>
    </ToastProvider>,
  );

const renderPane = () =>
  render(
    <ToastProvider>
      <AskPane
        sessionId={FLOW_SESSION_ID}
        onClose={() => useAppStore.getState().closeAsk({ sessionId: FLOW_SESSION_ID })}
      />
    </ToastProvider>,
  );

const pane = (): HTMLElement => screen.getByRole('region', { name: 'Ask' });

const field = (): HTMLTextAreaElement => {
  const element = within(pane()).getByRole('textbox', { name: 'Ask about this session' });
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error('the Ask field is not a text area');
  }
  return element;
};

type LensParams = {
  readonly lens: LensKind | null;
};

const goTo = ({ lens }: LensParams): void => {
  act(() =>
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId: FLOW_SESSION_ID, lens }) }),
  );
};

type MessageParams = {
  readonly id: string;
  readonly role: ChatMessage['role'];
  readonly content: string;
  readonly status: ChatMessage['status'];
};

const messageOf = ({ id, role, content, status }: MessageParams): ChatMessage => ({
  id: brandId<ChatMessageId>({ value: id }),
  chatId: THREAD_ID,
  role,
  content,
  status,
  reads: [],
  attachments: [],
  error: null,
  provider: role === 'assistant' ? 'anthropic' : null,
  model: role === 'assistant' ? 'claude-sonnet-5-5' : null,
  effort: role === 'assistant' ? 'low' : null,
  createdAt: brandId<IsoDateTime>({ value: '2026-11-23T09:00:00.000Z' }),
  updatedAt: brandId<IsoDateTime>({ value: '2026-11-23T09:00:06.000Z' }),
});

describe('the Ask panel in the dock', () => {
  it('opens from ⌘L as a tool of the dock grid, and the Overview keeps its face', async () => {
    renderWorkspace();
    expect(selectIsAskOpen({ state: useAppStore.getState(), sessionId: FLOW_SESSION_ID })).toBe(
      false,
    );

    act(() => {
      pressShortcut({ id: 'ask.open' });
    });
    renderPane();

    await waitFor(() => expect(document.activeElement).toBe(field()));
    expect(selectGridTool({ state: useAppStore.getState(), kind: 'ask' })?.sessionId).toBe(
      FLOW_SESSION_ID,
    );
    expect(document.querySelector('[data-session-desk]')).toBeNull();
    expect(selectDetailDrawer({ state: useAppStore.getState() })).toBeNull();
  });

  it('stays the same panel, with its draft, while the user moves between the tabs', async () => {
    renderWorkspace();
    act(() => useAppStore.getState().openAsk({ sessionId: FLOW_SESSION_ID }));
    renderPane();
    const before = pane();
    fireEvent.change(field(), { target: { value: 'Who changed applyCredit?' } });

    const lenses: ReadonlyArray<LensKind | null> = ['workflows', 'plans', 'context', null];
    for (const lens of lenses) {
      goTo({ lens });
      await waitFor(() =>
        expect(useAppStore.getState().activeLens[FLOW_SESSION_ID] ?? null).toBe(lens),
      );
      expect(pane()).toBe(before);
      expect(field().value).toBe('Who changed applyCredit?');
    }
  });

  it('closes on its Close button and opens again on ask.open', async () => {
    renderWorkspace();
    act(() => useAppStore.getState().openAsk({ sessionId: FLOW_SESSION_ID }));
    renderPane();

    fireEvent.click(within(pane()).getByRole('button', { name: 'Close' }));

    expect(selectIsAskOpen({ state: useAppStore.getState(), sessionId: FLOW_SESSION_ID })).toBe(
      false,
    );
    act(() => {
      pressShortcut({ id: 'ask.open' });
    });
    expect(selectIsAskOpen({ state: useAppStore.getState(), sessionId: FLOW_SESSION_ID })).toBe(
      true,
    );
  });

  it('shows nothing for a session that is gone', () => {
    const { container } = render(
      <AskPane
        sessionId={brandId<SessionId>({ value: 'session-gone' })}
        onClose={() => undefined}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('writes a streaming answer as it comes, offers Stop, and settles with its footer', async () => {
    act(() => {
      useAppStore.getState().openAsk({ sessionId: FLOW_SESSION_ID });
      useAppStore.setState({
        askThreadId: { [FLOW_SESSION_ID]: THREAD_ID },
        askMessages: {
          [THREAD_ID]: [
            messageOf({ id: 'pane-q1', role: 'user', content: 'What needs me?', status: 'done' }),
            messageOf({
              id: 'pane-a1',
              role: 'assistant',
              content: '**One question waits on you.** The',
              status: 'streaming',
            }),
          ],
        },
        askStreams: {
          [THREAD_ID]: {
            runId: brandId<ProviderRunId>({ value: 'run-pane' }),
            messageId: ANSWER_ID,
            isStopping: false,
          },
        },
      });
    });

    renderPane();
    await within(pane()).findByLabelText('Stop');
    expect(within(pane()).queryByTestId('ask-footer')).toBeNull();

    act(() => {
      useAppStore.setState({
        askMessages: {
          [THREAD_ID]: [
            messageOf({ id: 'pane-q1', role: 'user', content: 'What needs me?', status: 'done' }),
            messageOf({
              id: 'pane-a1',
              role: 'assistant',
              content: '**One question waits on you.** The Reviewer asks about retries.',
              status: 'done',
            }),
          ],
        },
        askStreams: {},
      });
    });

    await within(pane()).findByTestId('ask-footer');
    expect(within(pane()).getByTestId('ask-answer').querySelector('strong')?.textContent).toBe(
      'One question waits on you.',
    );
    within(pane()).getByPlaceholderText('Ask a follow up');
  });

  it('asks a chip at once, with the session it was opened on', async () => {
    const sendAskQuestion = vi.fn(async () => true);
    useAppStore.setState({ sendAskQuestion });
    act(() => useAppStore.getState().openAsk({ sessionId: FLOW_SESSION_ID }));
    renderPane();

    const chips = within(within(pane()).getByRole('group', { name: 'Try asking' })).getAllByRole(
      'button',
    );
    const chip = chips[0];
    if (chip === undefined) {
      throw new Error('no chip to try');
    }
    fireEvent.click(chip);

    expect(sendAskQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: FLOW_SESSION_ID, question: chip.textContent }),
    );
  });
});
