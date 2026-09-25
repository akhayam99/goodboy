import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
}));

vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({
    children,
    isEscapeEnabled,
  }: {
    children: (requestClose: () => void) => ReactNode;
    isEscapeEnabled: boolean;
  }) => {
    h.isEscapeEnabled = isEscapeEnabled;
    return <div>{children(vi.fn())}</div>;
  },
}));

vi.mock('../../../../shared/lib/editor', () => ({ openUrl: h.openUrl }));

vi.mock('../../../../store', () => ({
  useSessionById: (id: SessionId | null) =>
    id === LINKED_SESSION_ID ? { id, goal: '**Fix** the crash' } : null,
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

const rowOrder = (): ReadonlyArray<string> =>
  within(screen.getByRole('listbox', { name: 'Inbox items' }))
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');

const facet = (section: string, name: RegExp) =>
  within(
    within(screen.getByRole('navigation', { name: 'Filter the inbox' })).getByRole('region', {
      name: section,
    }),
  ).getByRole('button', { name });

const press = (key: string) => fireEvent.keyDown(window, { key, code: key });

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
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('InboxStudio', () => {
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

    fireEvent.change(screen.getByLabelText('Search the inbox'), {
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

    expect(screen.queryByRole('region', { name: 'Type' })).not.toBeNull();
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

  it('opens with nothing selected and opens the detail on a click', () => {
    renderStudio();

    expect(detailText()).toBe('none');

    fireEvent.click(screen.getByRole('option', { name: /Ship the inbox/ }));

    expect(detailText()).toBe('ENG-1');
  });

  it('closes the detail from its close control and keeps the list', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('option', { name: /Ship the inbox/ }));
    fireEvent.click(screen.getByTestId('detail-deselect'));

    expect(detailText()).toBe('none');
    expect(screen.getByText('Ship the inbox')).toBeDefined();
  });

  it('moves with j and k and the detail follows', () => {
    renderStudio();

    press('j');
    expect(detailText()).toBe('GBY-1');

    press('j');
    expect(detailText()).toBe('ENG-1');

    press('k');
    expect(detailText()).toBe('GBY-1');
  });

  it('runs the primary action on Enter', () => {
    renderStudio();

    press('j');
    expect(screen.getByTestId('detail').getAttribute('data-launch-request')).toBe('0');

    press('Enter');

    expect(screen.getByTestId('detail').getAttribute('data-launch-request')).toBe('1');
  });

  it('opens the selected record in its tool on o', () => {
    h.records = [{ ...linearIssue, url: 'https://example.invalid/linear/ENG-1' }];
    renderStudio();

    press('j');
    press('o');

    expect(h.openUrl).toHaveBeenCalledWith('https://example.invalid/linear/ENG-1');
  });

  it('focuses the search on / and the composer on r', () => {
    renderStudio();

    press('/');
    expect(document.activeElement).toBe(screen.getByLabelText('Search the inbox'));

    (document.activeElement as HTMLElement).blur();
    press('j');
    press('r');
    expect(document.activeElement).toBe(screen.getByLabelText('Comment'));
  });

  it('closes the detail on Escape before the studio', () => {
    renderStudio();

    expect(h.isEscapeEnabled).toBe(true);
    fireEvent.click(screen.getByRole('option', { name: /Ship the inbox/ }));
    expect(h.isEscapeEnabled).toBe(false);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(detailText()).toBe('none');
    expect(h.isEscapeEnabled).toBe(true);
  });

  it('keeps the selected record in the detail when the filters hide it', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('option', { name: /TypeError boom/ }));
    fireEvent.change(screen.getByLabelText('Search the inbox'), {
      target: { value: 'nothing matches this' },
    });

    expect(screen.getByText('No items match these filters')).toBeDefined();
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
    expect(screen.getByText('No items match these filters')).toBeDefined();

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

  it('shows the with a session view', () => {
    h.records = [linkedSentryError, sentryError, linearIssue];

    renderStudio();

    fireEvent.click(facet('View', /With a session/));

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
