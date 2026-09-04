import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  GithubIssue,
  IsoDateTime,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { useGithubIssue } from '../../../../../github/useGithubIssue';
import { GithubTaskDetail } from './GithubTaskDetail';

vi.mock('../../../../../github/useGithubIssue', () => ({
  useGithubIssue: vi.fn(),
}));

vi.mock('../../../../../github/useGithubIssueComments', () => ({
  useGithubIssueComments: () => ({ comments: [], isLoading: false, error: null, post: null }),
}));

const useGithubIssueMock = vi.mocked(useGithubIssue);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const TASK: SessionExternalTask = {
  sessionId: 'session-1' as SessionId,
  provider: 'github',
  externalId: '42',
  identifier: '#42',
  title: 'Add issue dashboard',
  url: 'https://github.com/goodboy/goodboy/issues/42',
  createdAt: '2026-07-22T12:00:00.000Z' as IsoDateTime,
};

const ISSUE: GithubIssue = {
  number: 42,
  title: 'Add issue dashboard',
  body: 'Show assigned issues in GitHub Studio.',
  url: 'https://github.com/goodboy/goodboy/issues/42',
  state: 'OPEN',
  labels: ['feature'],
  updatedAt: '2026-07-22T10:00:00Z',
};

afterEach(cleanup);

describe('GithubTaskDetail', () => {
  it('shows a loading skeleton while the issue is being fetched', () => {
    useGithubIssueMock.mockReturnValue({
      issue: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<GithubTaskDetail workspaceId={WORKSPACE_ID} rootPath="/repo" task={TASK} />);

    expect(screen.getByRole('status', { name: 'Loading GitHub issue' })).toBeDefined();
  });

  it('shows an error with a retry action that calls refetch', () => {
    const refetch = vi.fn();
    useGithubIssueMock.mockReturnValue({
      issue: null,
      isLoading: false,
      error: 'gh issue view failed',
      refetch,
    });

    render(<GithubTaskDetail workspaceId={WORKSPACE_ID} rootPath="/repo" task={TASK} />);

    expect(screen.getByRole('alert')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('renders the loaded issue title, description and properties', () => {
    useGithubIssueMock.mockReturnValue({
      issue: ISSUE,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<GithubTaskDetail workspaceId={WORKSPACE_ID} rootPath="/repo" task={TASK} />);

    expect(screen.getByText('Add issue dashboard')).toBeDefined();
    expect(screen.getByText('Show assigned issues in GitHub Studio.')).toBeDefined();
    expect(screen.getByText('feature')).toBeDefined();
  });

  it('renders the session eyebrow above the loaded issue title', () => {
    useGithubIssueMock.mockReturnValue({
      issue: ISSUE,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <GithubTaskDetail
        workspaceId={WORKSPACE_ID}
        rootPath="/repo"
        task={TASK}
        eyebrow={<span>Ship the lens eyebrow</span>}
      />,
    );

    const eyebrow = screen.getByText('Ship the lens eyebrow');
    const title = screen.getByRole('heading', { level: 2, name: 'Add issue dashboard' });
    expect(eyebrow.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('falls back to the linked task number when no issue number is given', () => {
    useGithubIssueMock.mockReturnValue({
      issue: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<GithubTaskDetail workspaceId={WORKSPACE_ID} rootPath="/repo" task={TASK} />);

    expect(useGithubIssueMock).toHaveBeenCalledWith(expect.objectContaining({ issueNumber: 42 }));
  });

  it('uses the given issue number over the linked task number', () => {
    useGithubIssueMock.mockReturnValue({
      issue: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <GithubTaskDetail workspaceId={WORKSPACE_ID} rootPath="/repo" task={TASK} issueNumber={7} />,
    );

    expect(useGithubIssueMock).toHaveBeenCalledWith(expect.objectContaining({ issueNumber: 7 }));
  });

  it('uses the issue identifier as the title when no linked task supplies one', () => {
    useGithubIssueMock.mockReturnValue({
      issue: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<GithubTaskDetail workspaceId={WORKSPACE_ID} rootPath="/repo" issueNumber={7} />);

    expect(screen.getByRole('heading', { level: 2, name: '#7' })).toBeDefined();
  });
});
