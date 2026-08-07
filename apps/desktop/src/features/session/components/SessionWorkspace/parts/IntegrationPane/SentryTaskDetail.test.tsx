import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import type { SentryIssue } from '../../../../../integrations/sentry/client';
import { formatAbsoluteDateTime } from '../../../../../../shared/utils/relativeDate';
import { useSentryIssue } from '../../../../../integrations/sentry/useSentryIssue';
import { useSentryIssueDetail } from '../../../../../integrations/sentry/useSentryIssueDetail';
import { SentryTaskDetail } from './SentryTaskDetail';

vi.mock('../../../../../integrations/sentry/useSentryIssue', () => ({
  useSentryIssue: vi.fn(),
}));

vi.mock('../../../../../integrations/sentry/useSentryIssueDetail', () => ({
  useSentryIssueDetail: vi.fn(),
}));

const useSentryIssueMock = vi.mocked(useSentryIssue);
const useSentryIssueDetailMock = vi.mocked(useSentryIssueDetail);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const TASK: SessionExternalTask = {
  sessionId: 'session-1' as SessionId,
  provider: 'sentry',
  externalId: '42',
  identifier: 'GOODBOY-42',
  title: 'Request failed',
  url: 'https://sentry.io/issues/42',
  createdAt: '2026-07-22T12:00:00.000Z' as IsoDateTime,
};

const ISSUE: SentryIssue = {
  id: '42',
  shortId: 'GOODBOY-42',
  title: 'TypeError: request failed',
  culprit: 'api/items',
  level: 'error',
  status: 'unresolved',
  count: '128',
  userCount: 9,
  firstSeen: '2026-07-01T09:00:00Z',
  lastSeen: '2026-07-23T10:00:00Z',
  permalink: 'https://sentry.io/issues/42',
  metadata: null,
};

const noDetail = () => {
  useSentryIssueDetailMock.mockReturnValue({ detail: null, isLoading: false, error: null });
};

const detailWithFrames = () => {
  useSentryIssueDetailMock.mockReturnValue({
    detail: {
      issueId: '42',
      title: 'TypeError: request failed',
      culprit: 'api/items',
      frames: [{ filename: 'items.ts', function: 'loadItems', line_no: 12, in_app: true }],
      tags: [],
      breadcrumbs: [],
    },
    isLoading: false,
    error: null,
  });
};

const termValuePairs = (panel: HTMLElement) => {
  return Object.fromEntries(
    within(panel)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent ?? '']),
  );
};

afterEach(cleanup);

describe('SentryTaskDetail', () => {
  it('shows a loading skeleton for the summary while the stack trace keeps rendering', () => {
    detailWithFrames();
    useSentryIssueMock.mockReturnValue({
      issue: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<SentryTaskDetail workspaceId={WORKSPACE_ID} task={TASK} />);

    expect(screen.getByRole('status', { name: 'Loading Sentry issue details' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'TypeError: request failed' })).toBeDefined();
    expect(screen.getByText(/loadItems/)).toBeDefined();
  });

  it('shows a retryable error for the summary while the stack trace keeps rendering', () => {
    const refetch = vi.fn();
    detailWithFrames();
    useSentryIssueMock.mockReturnValue({
      issue: null,
      isLoading: false,
      error: 'invalid response shape',
      refetch,
    });

    render(<SentryTaskDetail workspaceId={WORKSPACE_ID} task={TASK} />);

    expect(screen.getByRole('alert')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'TypeError: request failed' })).toBeDefined();
    expect(screen.getByText(/loadItems/)).toBeDefined();
  });

  it('renders level, culprit, status, counts and seen timestamps for the linked issue', () => {
    noDetail();
    useSentryIssueMock.mockReturnValue({
      issue: ISSUE,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SentryTaskDetail workspaceId={WORKSPACE_ID} task={TASK} />);

    const panel = screen.getByTestId('detail-properties');
    const pairs = termValuePairs(panel);
    expect(Object.keys(pairs)).toEqual([
      'Culprit',
      'Status',
      'Events',
      'Users',
      'First seen',
      'Last seen',
    ]);
    expect(pairs.Culprit).toBe('api/items');
    expect(pairs.Status).toBe('unresolved');
    expect(pairs.Events).toBe('128');
    expect(pairs.Users).toBe('9');
    expect(pairs['First seen']).toBe(formatAbsoluteDateTime({ iso: ISSUE.firstSeen ?? '' }));
    expect(pairs['Last seen']).toBe(formatAbsoluteDateTime({ iso: ISSUE.lastSeen ?? '' }));
    expect(pairs['First seen']).not.toBe(pairs['Last seen']);
    expect(pairs.Events).not.toBe(pairs.Users);
    expect(screen.getByText('error')).toBeDefined();
  });
});
