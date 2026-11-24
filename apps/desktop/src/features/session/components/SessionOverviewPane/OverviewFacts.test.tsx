// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type ChatId,
  type ChatSessionLinkId,
  type IsoDateTime,
  type SessionExternalTask,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

let useAppStore: StoryStore;
let OverviewFacts: typeof import('./OverviewFacts').OverviewFacts;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ OverviewFacts } = await import('./OverviewFacts'));
}, STORE_IMPORT_TIMEOUT_MS);

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'ws-harborline' });
const SESSION_ID = brandId<SessionId>({ value: 'session-duplicate-credit' });
const NOW = brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' });
const CHAT_ID = brandId<ChatId>({ value: 'chat-retry' });
const SESSION = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });

type TaskParams = Partial<SessionExternalTask> & {
  readonly identifier: string;
  readonly title: string;
};

const taskOf = ({ identifier, title, ...rest }: TaskParams): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: identifier.toLowerCase(),
  identifier,
  title,
  url: `https://linear.app/harborline/issue/${identifier}`,
  createdAt: NOW,
  scope: 'session',
  relation: 'part-of',
  ...rest,
});

const HBL_412 = taskOf({
  identifier: 'HBL-412',
  title: 'Stop retried webhooks posting a second credit',
});

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [SESSION],
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    chatsByWorkspace: { [WORKSPACE_ID]: [] },
    archivedChatsByWorkspace: { [WORKSPACE_ID]: [] },
    chatLinks: {},
    sessionExternalTasks: { [SESSION_ID]: [] },
  });
});

afterEach(cleanup);

const facts = (): HTMLElement => {
  const row = document.querySelector<HTMLElement>('[data-overview-facts]');
  if (row === null) {
    throw new Error('The facts row is missing');
  }
  return row;
};

describe('OverviewFacts origin', () => {
  it('leads with nothing when no ticket and no chat started the session', () => {
    render(<OverviewFacts sessionId={SESSION_ID} elapsedMs={0} />);

    expect(facts().querySelector('[data-overview-ticket]')).toBeNull();
    expect(within(facts()).queryByText(/From chat/)).toBeNull();
  });

  it('leads with the one linked ticket: glyph, key, title, and opens it', () => {
    useAppStore.setState({ sessionExternalTasks: { [SESSION_ID]: [HBL_412] } });
    render(<OverviewFacts sessionId={SESSION_ID} elapsedMs={0} />);

    expect(facts().firstElementChild?.matches('[data-overview-ticket]')).toBe(true);
    const open = within(facts()).getByRole('button', { name: 'Open HBL-412' });
    expect(open.getAttribute('title')).toBe('Stop retried webhooks posting a second credit');
    expect(open.textContent).toBe('HBL-412Stop retried webhooks posting a second credit');
    expect(within(facts()).queryByRole('button', { name: /linked tasks/ })).toBeNull();

    fireEvent.click(open);

    expect(useAppStore.getState().focusedExternalTask[SESSION_ID]?.externalId).toBe('hbl-412');
  });

  it('offers Open in Linear in the ticket menu', () => {
    useAppStore.setState({ sessionExternalTasks: { [SESSION_ID]: [HBL_412] } });
    render(<OverviewFacts sessionId={SESSION_ID} elapsedMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for HBL-412' }));

    expect(screen.getByRole('menuitem', { name: /Open in Linear/ })).toBeInstanceOf(HTMLElement);
    expect(screen.queryByRole('menuitem', { name: /^Open$/ })).toBeNull();
  });

  it('names the session part-of ticket first and keeps the others behind +N', () => {
    useAppStore.setState({
      sessionExternalTasks: {
        [SESSION_ID]: [
          taskOf({
            identifier: 'HBL-398',
            title: 'Ledger rounding on refunds',
            scope: 'branch',
            branch: 'hl/ledger-rounding',
          }),
          taskOf({ identifier: 'HBL-405', title: 'Payout limits', relation: 'closes' }),
          HBL_412,
        ],
      },
    });
    render(<OverviewFacts sessionId={SESSION_ID} elapsedMs={0} />);

    expect(within(facts()).getByRole('button', { name: 'Open HBL-412' })).toBeInstanceOf(
      HTMLElement,
    );
    expect(within(facts()).queryByText('HBL-398')).toBeNull();
    const more = within(facts()).getByRole('button', { name: 'Open all 3 linked tasks' });
    expect(more.textContent).toBe('+2');

    fireEvent.click(more);

    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe('context');
  });

  it('leads with the ticket and draws no chat line when a chat also started the session', () => {
    useAppStore.setState({
      sessionExternalTasks: { [SESSION_ID]: [HBL_412] },
      chatsByWorkspace: {
        [WORKSPACE_ID]: [
          {
            id: CHAT_ID,
            workspaceId: WORKSPACE_ID,
            title: 'Payments retry design',
            provider: 'anthropic',
            model: 'sonnet-5',
            effort: null,
            pinnedAt: null,
            archivedAt: null,
            createdAt: NOW,
            updatedAt: NOW,
            lastActivityAt: NOW,
            preview: null,
            modelsUsed: [],
            messageCount: 0,
          },
        ],
      },
      chatLinks: {
        [CHAT_ID]: [
          {
            id: brandId<ChatSessionLinkId>({ value: 'link-chat-retry' }),
            chatId: CHAT_ID,
            sessionId: SESSION_ID,
            messageId: null,
            kind: 'new',
            createdAt: NOW,
          },
        ],
      },
    });
    render(<OverviewFacts sessionId={SESSION_ID} elapsedMs={0} />);

    expect(facts().firstElementChild?.matches('[data-overview-ticket]')).toBe(true);
    expect(within(facts()).queryByText(/From chat|Payments retry design/)).toBeNull();
  });
});
