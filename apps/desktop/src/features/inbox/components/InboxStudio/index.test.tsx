import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pressKey, pressShortcut } from '../../../../__tests__/helpers/pressKey';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { InboxProvider, InboxRecord } from '../../types';

const LINKED_SESSION_ID = 'session-7' as SessionId;

const ALL_PROVIDERS: ReadonlyArray<InboxProvider> = [
  'github',
  'gitlab',
  'bitbucket',
  'linear',
  'jira',
  'slack',
  'sentry',
];

const h = vi.hoisted(() => ({
  records: [] as InboxRecord[],
  isLoading: false,
  connected: [] as ReadonlyArray<string>,
  errors: {
    github: null as string | null,
    gitlab: null as string | null,
    linear: null as string | null,
    jira: null as string | null,
    sentry: null as string | null,
    slack: null as string | null,
    bitbucket: null as string | null,
  },
  refetch: vi.fn(),
  openUrl: vi.fn(async () => undefined),
  isEscapeEnabled: true as boolean,
  closeLabel: '' as string,
  toggleStar: vi.fn<(record: InboxRecord) => Promise<void>>(async () => undefined),
  orderCalls: 0,
  stars: null as unknown,
}));

vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({
    children,
    isEscapeEnabled,
    closeLabel,
  }: {
    children: (requestClose: () => void) => ReactNode;
    isEscapeEnabled: boolean;
    closeLabel: string;
  }) => {
    h.isEscapeEnabled = isEscapeEnabled;
    h.closeLabel = closeLabel;
    return <div>{children(vi.fn())}</div>;
  },
}));

vi.mock('../../../../shared/lib/editor', () => ({ openUrl: h.openUrl }));

vi.mock('../../../../store', () => ({
  useSessionById: (id: SessionId | null) =>
    id === LINKED_SESSION_ID ? { id, goal: '**Fix** the crash' } : null,
  useAppStore: <T,>(
    selector: (state: {
      readonly workspaces: ReadonlyArray<never>;
      readonly sessions: ReadonlyArray<never>;
      readonly sessionExternalTasks: Readonly<Record<string, never>>;
    }) => T,
  ) => selector({ workspaces: [], sessions: [], sessionExternalTasks: {} }),
}));

vi.mock('../../useInboxStars', () => {
  h.stars = {
    rows: [],
    isStarred: () => false,
    canStar: () => true,
    toggle: h.toggleStar,
  };
  return { useInboxStars: () => h.stars };
});

vi.mock('../../orderInboxRecords', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../orderInboxRecords')>();
  return {
    orderInboxRecords: (params: Parameters<typeof actual.orderInboxRecords>[0]) => {
      h.orderCalls += 1;
      return actual.orderInboxRecords(params);
    },
  };
});

vi.mock('../../../integrations/hooks/useWorkspaceIssueLookup', () => ({
  useWorkspaceIssueLookup: () => ({
    code: null,
    state: { status: 'idle' },
    retry: () => undefined,
  }),
}));

vi.mock('../../useInboxRecords', () => ({
  useInboxRecords: () => ({
    records: h.records,
    isLoading: h.isLoading,
    loading: {
      github: false,
      gitlab: false,
      linear: false,
      jira: false,
      sentry: false,
      slack: false,
      bitbucket: false,
    },
    errors: h.errors,
    connected: h.connected,
    refetch: h.refetch,
  }),
}));

vi.mock('./InboxDetail', () => ({
  InboxDetail: ({
    record,
    onDeselect,
    launchFocusRequest,
  }: {
    record: InboxRecord;
    onDeselect: () => void;
    launchFocusRequest: number;
  }) => (
    <div data-testid="detail" data-launch-request={launchFocusRequest}>
      {record.identifier}
      <button type="button" data-testid="detail-deselect" onClick={onDeselect} />
      <textarea aria-label="Comment" />
    </div>
  ),
}));

const { InboxStudio } = await import('.');

const record = (overrides: Partial<InboxRecord> & Pick<InboxRecord, 'key'>): InboxRecord => ({
  provider: 'github',
  kind: 'issue',
  identifier: '#0',
  title: 'untitled',
  state: 'open',
  updatedAt: '2026-08-01T10:00:00Z',
  url: '',
  stateLabel: 'Open',
  context: '',
  payload: {
    provider: 'github',
    kind: 'issue',
    issue: {
      number: 0,
      title: 'untitled',
      body: '',
      url: '',
      state: 'OPEN',
      labels: [],
      updatedAt: '',
    },
    sessionId: null,
  },
  ...overrides,
});

const githubIssue = record({
  key: 'github:issue:1',
  provider: 'github',
  kind: 'issue',
  identifier: '#1',
  title: 'Fix the flaky test',
  updatedAt: '2026-08-01T10:00:00Z',
});

const slackThread = record({
  key: 'slack:thread:1',
  provider: 'slack',
  kind: 'thread',
  identifier: '#eng',
  title: 'ping the team',
  state: 'active',
  updatedAt: '2026-08-02T10:00:00Z',
  payload: {
    provider: 'slack',
    kind: 'thread',
    channel: { id: 'C1', name: 'eng', isMember: true, topic: null, memberCount: 1 },
    head: {
      ts: '1',
      threadTs: '1',
      userId: null,
      botId: null,
      text: 'ping the team',
      subtype: null,
      replyCount: 1,
      replyUserCount: 1,
      postedAt: null,
      latestReplyAt: null,
      reactions: [],
    },
    sessionId: null,
  },
});

const linearIssue = record({
  key: 'linear:issue:1',
  provider: 'linear',
  kind: 'issue',
  identifier: 'ENG-1',
  title: 'Ship the inbox',
  state: 'active',
  updatedAt: '2026-08-03T10:00:00Z',
  payload: {
    provider: 'linear',
    kind: 'issue',
    issue: {
      id: '1',
      identifier: 'ENG-1',
      title: 'Ship the inbox',
      description: null,
      url: '',
      state: { name: 'In Progress', type: 'started' },
      team: { key: 'ENG' },
      updatedAt: '',
    },
    sessionId: null,
  },
});

const sentryError = record({
  key: 'sentry:error:1',
  provider: 'sentry',
  kind: 'error',
  identifier: 'GBY-1',
  title: 'TypeError boom',
  state: 'alert',
  updatedAt: '2026-08-04T10:00:00Z',
  payload: {
    provider: 'sentry',
    kind: 'error',
    issue: {
      id: '1',
      shortId: 'GBY-1',
      title: 'TypeError boom',
      culprit: null,
      level: null,
      status: 'unresolved',
      count: null,
      userCount: null,
      firstSeen: null,
      lastSeen: null,
      permalink: null,
      metadata: null,
    },
    sessionId: null,
  },
});

const linkedSentryError = record({
  key: 'sentry:error:2',
  provider: 'sentry',
  kind: 'error',
  identifier: 'GBY-2',
  title: 'RangeError boom',
  state: 'alert',
  updatedAt: '2026-08-05T10:00:00Z',
  payload: {
    provider: 'sentry',
    kind: 'error',
    issue: {
      id: '2',
      shortId: 'GBY-2',
      title: 'RangeError boom',
      culprit: null,
      level: null,
      status: 'unresolved',
      count: null,
      userCount: null,
      firstSeen: null,
      lastSeen: null,
      permalink: null,
      metadata: null,
    },
    sessionId: LINKED_SESSION_ID,
  },
});

const workspaceId = 'workspace-1' as WorkspaceId;

const renderStudio = (overrides: Partial<Parameters<typeof InboxStudio>[0]> = {}) =>
  render(
    <InboxStudio workspaceId={workspaceId} rootPath="/repo" onClose={vi.fn()} {...overrides} />,
  );

const detailText = (): string => screen.queryByTestId('detail')?.textContent ?? 'none';

const cursorKeys = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('[data-inbox-key][data-cursor]')).map(
    (row) => row.getAttribute('data-inbox-key') ?? '',
  );

const rowOrder = (): ReadonlyArray<string> =>
  within(screen.getByRole('listbox', { name: 'Task items' }))
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');

const openFilters = (): void => {
  if (screen.queryByRole('navigation', { name: 'Filter tasks' }) !== null) {
    return;
  }
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
};

const facet = (section: string, name: RegExp) => {
  openFilters();
  return within(
    within(screen.getByRole('navigation', { name: 'Filter tasks' })).getByRole('group', {
      name: section,
    }),
  ).getByRole('button', { name });
};

const press = (id: ShortcutId, target?: Element) =>
  pressShortcut({ id, target: target ?? document.body });

const openRow = (name: RegExp): HTMLElement => screen.getByRole('option', { name });

beforeEach(() => {
  localStorage.clear();
  h.records = [sentryError, linearIssue, slackThread, githubIssue];
  h.isLoading = false;
  h.connected = ALL_PROVIDERS;
  h.errors = {
    github: null,
    gitlab: null,
    linear: null,
    jira: null,
    sentry: null,
    slack: null,
    bitbucket: null,
  };
  h.refetch.mockReset();
  h.openUrl.mockClear();
  h.toggleStar.mockClear();
  h.orderCalls = 0;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('InboxStudio', () => {
  it('names its close control after the Tasks page', () => {
    renderStudio();
    expect(h.closeLabel).toBe('Close tasks');
  });

  it('orders rows by time only, newest first, never by state', () => {
    h.records = [
      sentryError,
      linearIssue,
      slackThread,
      { ...githubIssue, updatedAt: '2026-08-09T10:00:00Z' },
    ];

    renderStudio();

    expect(rowOrder().map((text) => text.split(' ')[0])).toEqual(['#1', 'GBY-1', 'ENG-1', '#eng']);
  });

  it('filters rows by the search query', () => {
    renderStudio();

    fireEvent.change(screen.getByLabelText('Search tasks'), {
      target: { value: 'flaky' },
    });

    expect(screen.getByText('Fix the flaky test')).toBeDefined();
    expect(screen.queryByText('Ship the inbox')).toBeNull();
  });

  it('filters on the type facet and counts each type', () => {
    renderStudio();

    const errors = facet('Type', /Errors/);
    expect(errors.textContent).toContain('1');
    fireEvent.click(errors);

    expect(screen.getByText('TypeError boom')).toBeDefined();
    expect(screen.queryByText('Fix the flaky test')).toBeNull();
  });

  it('hides the types no connected tool can produce', () => {
    h.connected = ['github'];

    renderStudio();
    openFilters();

    expect(screen.queryByRole('group', { name: 'Type' })).not.toBeNull();
    expect(() => facet('Type', /Threads/)).toThrow();
    expect(() => facet('Type', /Errors/)).toThrow();
  });

  it('filters rows on one source at a time', () => {
    renderStudio();

    fireEvent.click(facet('Source', /GitHub/));

    expect(screen.getByText('Fix the flaky test')).toBeDefined();
    expect(screen.queryByText('Ship the inbox')).toBeNull();

    fireEvent.click(facet('Source', /Linear/));

    expect(screen.getByText('Ship the inbox')).toBeDefined();
    expect(screen.queryByText('Fix the flaky test')).toBeNull();
  });

  it('opens with a quiet cursor on the first row and no drawer', () => {
    renderStudio();

    expect(detailText()).toBe('none');
    const first = openRow(/TypeError boom/);
    expect(first.getAttribute('aria-selected')).toBe('false');
    expect(first.closest('[data-inbox-key]')?.getAttribute('data-cursor')).toBe('true');
    expect(
      openRow(/Ship the inbox/)
        .closest('[data-inbox-key]')
        ?.hasAttribute('data-cursor'),
    ).toBe(false);
    expect(document.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
  });

  it('opens the drawer on a click, with the row selected', () => {
    renderStudio();

    fireEvent.click(openRow(/Ship the inbox/));

    expect(openRow(/Ship the inbox/).getAttribute('aria-selected')).toBe('true');
    expect(openRow(/TypeError boom/).getAttribute('aria-selected')).toBe('false');
  });

  it('opens the detail of another row on a click', () => {
    renderStudio();

    fireEvent.click(openRow(/Ship the inbox/));

    expect(detailText()).toBe('ENG-1');
  });

  it('opens on the requested record, not the first row', () => {
    renderStudio({ initialRecordKey: 'github:issue:1' });

    expect(detailText()).toBe('#1');
  });

  it('puts the cursor on the first row once the records arrive, with no drawer', () => {
    h.records = [];
    const view = renderStudio();
    expect(cursorKeys()).toEqual([]);

    h.records = [sentryError, linearIssue];
    view.rerender(<InboxStudio workspaceId={workspaceId} rootPath="/repo" onClose={vi.fn()} />);

    expect(cursorKeys()).toEqual([sentryError.key]);
    expect(detailText()).toBe('none');
  });

  it('closes the detail from its close control and keeps the list and the cursor', () => {
    renderStudio();
    fireEvent.click(openRow(/Ship the inbox/));
    expect(detailText()).toBe('ENG-1');

    fireEvent.click(screen.getByTestId('detail-deselect'));

    expect(detailText()).toBe('none');
    expect(screen.getByText('Ship the inbox')).toBeDefined();
    expect(cursorKeys()).toEqual([linearIssue.key]);
  });

  it('keeps the detail closed after a close, until Enter or a click opens a row', () => {
    renderStudio();
    fireEvent.click(openRow(/Ship the inbox/));
    fireEvent.click(screen.getByTestId('detail-deselect'));
    expect(detailText()).toBe('none');

    press('list.next');
    expect(detailText()).toBe('none');
    expect(cursorKeys()).toEqual([slackThread.key]);

    press('list.open');
    expect(detailText()).toBe('#eng');
  });

  it('moves the cursor with the next and previous keys and opens nothing', () => {
    renderStudio();

    press('list.next');
    press('list.next');
    press('list.next');
    expect(detailText()).toBe('none');
    expect(cursorKeys()).toEqual([githubIssue.key]);

    press('list.previous');
    expect(detailText()).toBe('none');
    expect(cursorKeys()).toEqual([slackThread.key]);
  });

  it('makes the drawer follow the cursor once one is open', () => {
    renderStudio();

    fireEvent.click(openRow(/TypeError boom/));
    expect(detailText()).toBe('GBY-1');

    press('list.next');
    expect(detailText()).toBe('ENG-1');

    press('list.next');
    expect(detailText()).toBe('#eng');

    press('list.previous');
    expect(detailText()).toBe('ENG-1');
  });

  it('opens the cursor row and launches on Enter', () => {
    renderStudio();
    expect(screen.queryByTestId('detail')).toBeNull();

    press('list.open');

    expect(detailText()).toBe('GBY-1');
    expect(screen.getByTestId('detail').getAttribute('data-launch-request')).toBe('1');
    expect(openRow(/TypeError boom/).getAttribute('aria-selected')).toBe('true');
  });

  it('opens the row the cursor moved to on Enter', () => {
    renderStudio();

    press('list.next');
    press('list.open');

    expect(detailText()).toBe('ENG-1');
  });

  it('opens the first row in its tool on o', () => {
    h.records = [{ ...linearIssue, url: 'https://example.invalid/linear/ENG-1' }];
    renderStudio();

    press('list.openInTool');

    expect(h.openUrl).toHaveBeenCalledWith('https://example.invalid/linear/ENG-1');
    expect(screen.queryByTestId('detail')).toBeNull();
  });

  it('focuses the search on slash', () => {
    renderStudio();

    press('list.search');
    expect(document.activeElement).toBe(screen.getByLabelText('Search tasks'));
  });

  it('acts from a focused row, where the click left the focus', () => {
    renderStudio();
    const row = openRow(/Ship the inbox/);
    fireEvent.click(row);
    row.focus();
    expect(document.activeElement).toBe(row);

    press('list.next', row);
    expect(detailText()).toBe('#eng');

    press('list.open', openRow(/ping the team/));
    expect(screen.getByTestId('detail').getAttribute('data-launch-request')).toBe('1');
  });

  it('leaves the keys to the search field while typing in it', () => {
    renderStudio();
    const search = screen.getByLabelText('Search tasks');
    search.focus();

    const next = press('list.next', search);
    pressKey({ code: 'KeyO', target: search });

    expect(next.defaultPrevented).toBe(false);
    expect(h.openUrl).not.toHaveBeenCalled();
    expect(cursorKeys()).toEqual([sentryError.key]);
  });

  it('leaves the search field on Escape and gives the keys back to the list', () => {
    renderStudio();
    const search = screen.getByLabelText('Search tasks');
    search.focus();

    pressKey({ code: 'Escape', target: search });
    expect(document.activeElement).not.toBe(search);

    press('list.next');
    expect(cursorKeys()).toEqual([linearIssue.key]);
  });

  it('keeps the order of the rows while the keys move the cursor', () => {
    renderStudio();
    const ordered = h.orderCalls;
    expect(ordered).toBeGreaterThan(0);

    press('list.next');
    press('list.next');
    press('list.previous');
    press('list.reply');
    press('list.star');
    press('list.openInTool');

    expect(cursorKeys()).toEqual([linearIssue.key]);
    expect(h.orderCalls).toBe(ordered);
  });

  it('stars the selected row on s from the page body', () => {
    renderStudio();

    press('list.star');

    expect(h.toggleStar).toHaveBeenCalledTimes(1);
    expect(h.toggleStar.mock.calls[0]?.[0]).toMatchObject({ identifier: 'GBY-1' });
  });

  it('stars the selected row on s with the focus on a star button', () => {
    renderStudio();
    const star = screen.getByRole('button', { name: 'Star GBY-1' });
    star.focus();

    press('list.star', star);

    expect(h.toggleStar).toHaveBeenCalledTimes(1);
  });

  it('closes the detail on Escape before the studio, and keeps the cursor', () => {
    renderStudio();

    expect(h.isEscapeEnabled).toBe(true);
    fireEvent.click(openRow(/Ship the inbox/));
    expect(h.isEscapeEnabled).toBe(false);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(detailText()).toBe('none');
    expect(h.isEscapeEnabled).toBe(true);
    expect(cursorKeys()).toEqual([linearIssue.key]);
  });

  it('opens the cursor row and focuses the composer on R when no drawer is open', async () => {
    h.records = [githubIssue];
    renderStudio();
    expect(screen.queryByTestId('detail')).toBeNull();

    press('list.reply');

    await vi.waitFor(() => expect(document.activeElement?.tagName).toBe('TEXTAREA'));
    expect(detailText()).toBe('#1');
  });

  it('stars the cursor row on S without opening the drawer', () => {
    renderStudio();

    press('list.next');
    press('list.star');

    expect(h.toggleStar.mock.calls[0]?.[0]).toMatchObject({ identifier: 'ENG-1' });
    expect(screen.queryByTestId('detail')).toBeNull();
  });

  it('keeps the selected record in the detail when the filters hide it', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('option', { name: /TypeError boom/ }));
    fireEvent.change(screen.getByLabelText('Search tasks'), {
      target: { value: 'nothing matches this' },
    });

    expect(screen.getByText('No items match these filters.')).toBeDefined();
    expect(detailText()).toBe('GBY-1');
  });

  it('asks to connect a tool when nothing is connected', () => {
    h.records = [];
    h.connected = [];
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Connect a tool' }));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'goodboy:open-settings', detail: { scope: 'tools' } }),
    );
    dispatchSpy.mockRestore();
  });

  it('recovers from a deep-linked source with no records through clear filters', () => {
    renderStudio({ initialProvider: 'jira' });

    expect(facet('Source', /Jira/).getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('No items match these filters.')).toBeDefined();

    const [clear] = screen.getAllByRole('button', { name: 'Clear filters' });
    fireEvent.click(clear as HTMLElement);

    expect(screen.getByText('Fix the flaky test')).toBeDefined();
  });

  it('persists the source per workspace', () => {
    const first = renderStudio();

    fireEvent.click(facet('Source', /GitHub/));
    first.unmount();

    renderStudio();

    expect(facet('Source', /GitHub/).getAttribute('aria-current')).toBe('true');
    expect(screen.queryByText('Ship the inbox')).toBeNull();
  });

  it('keeps the first provider of a legacy multi-select as the source', () => {
    localStorage.setItem(
      'goodboy:inbox-kind-filter:workspace-1',
      JSON.stringify({ kindFilter: 'all', providers: ['slack', 'linear'] }),
    );

    renderStudio();

    expect(facet('Source', /Linear/).getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Ship the inbox')).toBeDefined();
    expect(screen.queryByText('ping the team')).toBeNull();
  });

  it('shows the has a session view', () => {
    h.records = [linkedSentryError, sentryError, linearIssue];

    renderStudio();

    fireEvent.click(facet('View', /Has a session/));

    expect(screen.getByText('RangeError boom')).toBeDefined();
    expect(screen.queryByText('TypeError boom')).toBeNull();
  });

  it('scopes the rows to the session it was opened for and names it in a token', () => {
    h.records = [linkedSentryError, sentryError, linearIssue, githubIssue];

    renderStudio({ initialSessionId: LINKED_SESSION_ID, initialRecordKey: linkedSentryError.key });

    expect(screen.getByText('Session: Fix the crash')).toBeDefined();
    expect(screen.getByText('RangeError boom')).toBeDefined();
    expect(screen.queryByText('TypeError boom')).toBeNull();
    expect(detailText()).toBe('GBY-2');
  });

  it('drops the session scope when the token is dismissed', () => {
    h.records = [linkedSentryError, sentryError, linearIssue, githubIssue];

    renderStudio({ initialSessionId: LINKED_SESSION_ID });

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear the session filter: Fix the crash' }),
    );

    expect(screen.queryByText('Session: Fix the crash')).toBeNull();
    expect(screen.getByText('TypeError boom')).toBeDefined();
  });

  it('preselects the type, source and record from the open event props', () => {
    renderStudio({
      initialKind: 'error',
      initialProvider: 'sentry',
      initialRecordKey: sentryError.key,
    });

    expect(detailText()).toBe('GBY-1');
    expect(screen.getByText('TypeError boom')).toBeDefined();
    expect(screen.queryByText('Ship the inbox')).toBeNull();
  });
});
