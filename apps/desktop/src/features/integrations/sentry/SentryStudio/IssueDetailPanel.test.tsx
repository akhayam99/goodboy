import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { SentryIssue } from '../client';
import { sentryFetchIssueDetail } from '../client';
import { IssueDetailPanel } from './IssueDetailPanel';

const h = vi.hoisted(() => ({
  createSession: vi.fn(),
  loadSetting: vi.fn(async () => null),
  showToast: vi.fn(),
  store: {
    workspaces: [{ id: 'workspace-1', rootPath: '/repo' }],
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (
      state: typeof h.store & {
        createSession: typeof h.createSession;
        loadSetting: typeof h.loadSetting;
      },
    ) => T,
  ) => selector({ ...h.store, createSession: h.createSession, loadSetting: h.loadSetting }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('../../../worktree/useBranchConflict', () => ({ useBranchConflict: () => null }));
vi.mock('../../../worktree/worktree', () => ({ removeWorktree: vi.fn() }));

vi.mock('../client', () => ({
  sentryFetchIssueDetail: vi.fn(),
}));

const fetchIssueDetail = vi.mocked(sentryFetchIssueDetail);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

type IssueParams = {
  readonly id: string;
  readonly title: string;
  readonly shortId: string;
};

const makeIssue = ({ id, title, shortId }: IssueParams): SentryIssue => ({
  id,
  shortId,
  title,
  culprit: null,
  level: 'error',
  status: 'unresolved',
  count: '1',
  userCount: 1,
  firstSeen: null,
  lastSeen: null,
  permalink: null,
  metadata: null,
});

beforeEach(() => {
  fetchIssueDetail.mockReset();
  h.loadSetting.mockClear();
});

afterEach(cleanup);

describe('IssueDetailPanel', () => {
  it('does not regenerate a switched issue goal from stale detail after a failed fetch', async () => {
    const firstIssue = makeIssue({
      id: 'issue-1',
      title: 'First issue',
      shortId: 'GB-1',
    });
    const secondIssue = makeIssue({
      id: 'issue-2',
      title: 'Second issue',
      shortId: 'GB-2',
    });
    fetchIssueDetail.mockResolvedValueOnce({
      title: 'First issue',
      culprit: null,
      frames: [
        {
          filename: 'src/first.ts',
          function: 'firstFrame',
          line_no: 42,
          in_app: true,
        },
      ],
    });

    const { rerender } = render(
      <IssueDetailPanel
        issue={firstIssue}
        sessionId={null}
        workspaceId={WORKSPACE_ID}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => {
      const goal = screen.getByRole('textbox', { name: 'Session goal' }) as HTMLTextAreaElement;
      expect(goal.value).toContain('firstFrame');
    });

    fetchIssueDetail.mockRejectedValueOnce(new Error('request failed'));
    rerender(
      <IssueDetailPanel
        issue={secondIssue}
        sessionId={null}
        workspaceId={WORKSPACE_ID}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('request failed')).toBeDefined());
    const goal = screen.getByRole('textbox', { name: 'Session goal' }) as HTMLTextAreaElement;
    expect(goal.value).toBe('[GB-2] Second issue');
    expect(goal.value).not.toContain('firstFrame');
  });

  it('surfaces event and user counts in the stats strip', async () => {
    const issue = {
      ...makeIssue({ id: 'issue-3', title: 'Third issue', shortId: 'GB-3' }),
      count: '128',
      userCount: 12,
    };
    fetchIssueDetail.mockResolvedValueOnce({ title: null, culprit: null, frames: [] });

    render(
      <IssueDetailPanel
        issue={issue}
        sessionId={null}
        workspaceId={WORKSPACE_ID}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Events')).toBeDefined());
    expect(screen.getByText('128')).toBeDefined();
    expect(screen.getByText('Users')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
  });
});
