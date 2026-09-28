// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  AgentId,
  IsoDateTime,
  SearchHit,
  SearchQuery,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('../../../integrations/hooks/useWorkspaceIssueLookup', () => ({
  useWorkspaceIssueLookup: () => ({
    code: null,
    state: { status: 'idle' },
    loadingProviders: [],
    retryAt: null,
    retry: () => undefined,
  }),
}));

import { useAppStore } from '../../../../store';
import { bindTarget } from '../../../actions/registry';
import { ToastProvider } from '../../../../app/components/Toast';
import { SearchMode } from './index';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const SESSION = 's-payout' as SessionId;
const ARCHIVED = 's-old' as SessionId;
const AGENT = 'a-builder' as AgentId;
const AT = '2026-09-20T10:00:00.000Z' as IsoDateTime;

type HitParams = Partial<SearchHit>;

const makeHit = ({ ...overrides }: HitParams): SearchHit => ({
  docId: 'message:m1',
  kind: 'message',
  refId: 'm1',
  workspaceId: WORKSPACE,
  sessionId: SESSION,
  sessionTitle: 'Speed up the payout export',
  agentId: AGENT,
  agentName: 'Payout builder',
  mountId: null,
  provider: 'codex',
  container: null,
  status: 'user',
  ordinal: null,
  url: null,
  isArchived: false,
  occurredAt: AT,
  title: [],
  snippet: [
    { text: 'The ', isMatch: false },
    { text: 'settlement', isMatch: true },
    { text: ' export times out', isMatch: false },
  ],
  ...overrides,
});

const HITS: ReadonlyArray<SearchHit> = [
  makeHit({}),
  makeHit({
    docId: 'session:s-payout',
    kind: 'session',
    refId: SESSION,
    agentId: null,
    agentName: null,
    status: 'idle',
    title: [{ text: 'Speed up the payout export', isMatch: false }],
    snippet: [],
  }),
  makeHit({
    docId: 'session:s-old',
    kind: 'session',
    refId: ARCHIVED,
    sessionId: ARCHIVED,
    agentId: null,
    isArchived: true,
    title: [{ text: 'Old settlement run', isMatch: false }],
    snippet: [],
  }),
];

const runSearch = vi.fn(async (_params: { readonly query: SearchQuery }) => HITS);
const navigate = vi.fn();
const startViewFind = vi.fn();
const onClose = vi.fn();
const onSwitchMode = vi.fn();

const lastQuery = (): SearchQuery | undefined => runSearch.mock.calls.at(-1)?.[0].query;

const flush = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
};

const onClearScope = vi.fn();

type RenderParams = {
  readonly initialQuery?: string;
};

const Harness = ({ initialQuery = '' }: RenderParams) => {
  const [query, setQuery] = useState(initialQuery);
  return (
    <SearchMode
      query={query}
      onQueryChange={setQuery}
      scope={{ kind: 'session', sessionId: SESSION }}
      onClearScope={onClearScope}
      onSwitchMode={onSwitchMode}
      onClose={onClose}
      modeSwitch={null}
    />
  );
};

const renderMode = async ({ initialQuery }: RenderParams = {}): Promise<void> => {
  render(
    <ToastProvider>
      <Harness initialQuery={initialQuery} />
    </ToastProvider>,
  );
  await flush();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE,
    currentSessionId: SESSION,
    workspaces: [{ id: WORKSPACE, name: 'Harborline', slug: 'harborline' } as never],
    sessions: [
      { id: SESSION, workspaceId: WORKSPACE, goal: 'Speed up the payout export' } as never,
    ],
    projects: [],
    runSearch,
    navigate,
    startViewFind,
    loadSearchIndexStatus: async () => undefined,
    searchIndexStatus: {
      docs: 10,
      bytes: 1000,
      scanned: 62,
      total: 100,
      isBackfillDone: false,
      excludedProjectIds: [],
    },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const input = (): HTMLInputElement => screen.getByRole('combobox', { name: 'Search' });

describe('search mode', () => {
  it('opens scoped to the session you are in and says how far indexing is', async () => {
    await renderMode();
    expect(screen.getByText('In session')).toBeTruthy();
    expect(lastQuery()).toMatchObject({ sessionId: SESSION, workspaceId: WORKSPACE });
    expect(screen.getByText('Indexing older sessions · 62%')).toBeTruthy();
  });

  it('turns a typed qualifier into a chip and searches with it', async () => {
    await renderMode();
    fireEvent.change(input(), { target: { value: 'settlement type:message ' } });
    await flush();
    expect(input().value).toBe('settlement ');
    expect(screen.getByRole('button', { name: 'Remove Type Messages' })).toBeTruthy();
    expect(lastQuery()).toMatchObject({ text: 'settlement ', kinds: ['message'] });
  });

  it('removes the last chip, then widens the scope, on Backspace in an empty field', async () => {
    await renderMode();
    fireEvent.change(input(), { target: { value: 'is:archived ' } });
    await flush();
    fireEvent.keyDown(input(), { key: 'Backspace' });
    await flush();
    expect(lastQuery()).toMatchObject({ archived: 'exclude', sessionId: SESSION });
    fireEvent.keyDown(input(), { key: 'Backspace' });
    await flush();
    expect(lastQuery()).toMatchObject({ sessionId: null, workspaceId: WORKSPACE });
    fireEvent.keyDown(input(), { key: 'Backspace' });
    await flush();
    expect(lastQuery()).toMatchObject({ sessionId: null, workspaceId: null });
    expect(onClearScope).toHaveBeenCalledTimes(1);
  });

  it('turns qualifiers carried over from commands into chips', async () => {
    await renderMode({ initialQuery: 'drift type:plan' });
    expect(input().value).toBe('drift ');
    expect(lastQuery()).toMatchObject({ text: 'drift ', kinds: ['plan'] });
  });

  it('marks the matched words and lands a message in its transcript on Enter', async () => {
    await renderMode();
    fireEvent.change(input(), { target: { value: 'settlement' } });
    await flush();
    const list = screen.getByRole('listbox', { name: 'Search results' });
    expect(within(list).getAllByText('settlement')[0]?.tagName).toBe('MARK');
    fireEvent.keyDown(input(), { key: 'Enter' });
    await flush();
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION, agentId: AGENT },
    });
    expect(startViewFind).toHaveBeenCalledWith({
      query: 'settlement',
      target: 'The settlement export times out',
    });
  });

  it('never opens an archived session and says why', async () => {
    await renderMode();
    fireEvent.change(input(), { target: { value: 'settlement' } });
    await flush();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    const preview = screen.getByRole('complementary', { name: 'Preview' });
    expect(within(preview).getByText(/archived\. Restore it/)).toBeTruthy();
    fireEvent.keyDown(input(), { key: 'Enter' });
    await flush();
    expect(onClose).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows exactly the registry actions of a session in the preview', async () => {
    await renderMode();
    fireEvent.change(input(), { target: { value: 'payout' } });
    await flush();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    const preview = screen.getByRole('complementary', { name: 'Preview' });
    const shown = within(preview)
      .getAllByRole('menuitem')
      .map((item) => item.getAttribute('aria-label') ?? item.textContent ?? '');
    const expected =
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'session', sessionId: SESSION },
      })
        ?.resolve()
        .map((action) => action.label) ?? [];
    expect(expected.length).toBeGreaterThan(0);
    expect(shown).toHaveLength(expected.length);
    expect(shown.every((label, index) => label.startsWith(expected[index] ?? '\u0000'))).toBe(true);
  });

  it('switches to commands with the same text on Tab', async () => {
    await renderMode();
    fireEvent.change(input(), { target: { value: 'payout' } });
    fireEvent.keyDown(input(), { key: 'Tab' });
    expect(onSwitchMode).toHaveBeenCalledTimes(1);
    expect(input().value).toBe('payout');
  });
});
