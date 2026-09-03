import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../types';

const h = vi.hoisted(() => ({
  records: [] as InboxRecord[],
  isLoading: false,
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
}));

vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({
    children,
    headerAccessory,
  }: {
    children: (requestClose: () => void) => ReactNode;
    headerAccessory: ReactNode;
  }) => (
    <div>
      {headerAccessory}
      {children(vi.fn())}
    </div>
  ),
}));

vi.mock('../../useInboxRecords', () => ({
  useInboxRecords: () => ({
    records: h.records,
    isLoading: h.isLoading,
    errors: h.errors,
    refetch: h.refetch,
  }),
}));

vi.mock('./InboxDetail', () => ({
  InboxDetail: ({ record }: { record: InboxRecord | null }) => (
    <div data-testid="detail">{record?.identifier ?? 'none'}</div>
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
  meta: '',
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

const workspaceId = 'workspace-1' as WorkspaceId;

const renderStudio = (overrides: Partial<Parameters<typeof InboxStudio>[0]> = {}) =>
  render(
    <InboxStudio
      workspaceId={workspaceId}
      rootPath="/repo"
      workspaceName="Goodboy"
      onClose={vi.fn()}
      {...overrides}
    />,
  );

beforeEach(() => {
  localStorage.clear();
  h.records = [sentryError, linearIssue, slackThread, githubIssue];
  h.isLoading = false;
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
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('InboxStudio', () => {
  it('renders every row sorted newest first', () => {
    renderStudio();

    const identifiers = screen
      .getAllByText(/^(#1|ENG-1|#eng|GBY-1)$/)
      .map((node) => node.textContent);

    expect(identifiers).toEqual(['GBY-1', 'ENG-1', '#eng', '#1']);
  });

  it('filters rows by the search query', () => {
    renderStudio();

    fireEvent.change(screen.getByLabelText('Search the inbox'), {
      target: { value: 'flaky' },
    });

    expect(screen.getByText('Fix the flaky test')).toBeDefined();
    expect(screen.queryByText('Ship the inbox')).toBeNull();
  });

  it('shows kind counts as string badges and filters on the errors tab', () => {
    renderStudio();

    const tablist = screen.getByRole('tablist', { name: 'Inbox kind filter' });
    expect(tablist.textContent).toContain('4');

    fireEvent.click(screen.getByRole('tab', { name: /Errors/ }));

    expect(screen.getByText('TypeError boom')).toBeDefined();
    expect(screen.queryByText('Fix the flaky test')).toBeNull();
  });

  it('filters rows by provider chip', () => {
    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'GitHub' }));

    expect(screen.getByText('Fix the flaky test')).toBeDefined();
    expect(screen.queryByText('Ship the inbox')).toBeNull();
  });

  it('renders the matching detail once a row is selected', () => {
    renderStudio();

    expect(screen.getByTestId('detail').textContent).toBe('none');

    fireEvent.click(screen.getByText('Ship the inbox'));

    expect(screen.getByTestId('detail').textContent).toBe('ENG-1');
  });

  it('shows a nothing-connected empty state when the inbox has no records', () => {
    h.records = [];
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    renderStudio();

    expect(screen.getByText('Nothing in your inbox yet')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Open integrations' }));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'goodboy:open-provider-studio' }),
    );
    dispatchSpy.mockRestore();
  });

  it('shows a filters-hide-everything empty state and clears filters', () => {
    renderStudio();

    fireEvent.change(screen.getByLabelText('Search the inbox'), {
      target: { value: 'nothing matches this' },
    });

    expect(screen.getByText('No matching items')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByText('Fix the flaky test')).toBeDefined();
  });

  it('preselects the kind filter, provider and record from the open event props', () => {
    renderStudio({
      initialKind: 'error',
      initialProvider: 'sentry',
      initialRecordKey: sentryError.key,
    });

    expect(screen.getByTestId('detail').textContent).toBe('GBY-1');
    expect(screen.getByText('TypeError boom')).toBeDefined();
    expect(screen.queryByText('Ship the inbox')).toBeNull();
  });
});
