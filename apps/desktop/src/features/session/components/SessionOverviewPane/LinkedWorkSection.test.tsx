// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Session,
  SessionExternalTask,
  SessionId,
  Workspace,
  WorkspaceId,
  IsoDateTime,
} from '@goodboy/types';

type Store = {
  sessionGithub: Record<
    string,
    {
      pr?: {
        number: number;
        title: string;
        state: 'draft' | 'open' | 'approved' | 'queued' | 'merged' | 'closed';
      } | null;
      linkedIssues?: ReadonlyArray<{ number: number; title?: string; url: string }>;
      detail?: {
        comments: ReadonlyArray<{ source: 'issue' | 'review'; resolved?: boolean }>;
      } | null;
    }
  >;
  sessionExternalTasks: Record<string, ReadonlyArray<SessionExternalTask>>;
  sessions: ReadonlyArray<Session>;
  workspaces: ReadonlyArray<Workspace>;
};

const { store, mocks } = vi.hoisted(() => ({
  store: {
    sessionGithub: {},
    sessionExternalTasks: {},
    sessions: [],
    workspaces: [],
  } as Store,
  mocks: {
    openUrl: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openUrl: mocks.openUrl,
}));

import { LinkedWorkSection } from './LinkedWorkSection';

beforeEach(() => {
  store.sessionGithub = {};
  store.sessionExternalTasks = {};
  store.sessions = [];
  store.workspaces = [];
  mocks.openUrl.mockClear();
});

afterEach(cleanup);

describe('LinkedWorkSection', () => {
  it('does not duplicate pull requests or merge requests from their dedicated surfaces', () => {
    store.sessionGithub = {
      'sess-1': {
        pr: { number: 42, title: 'Ship linked work', state: 'open' },
      },
    };

    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={vi.fn()} />);

    expect(screen.queryByText('#42')).toBeNull();
    expect(screen.queryByText('Ship linked work')).toBeNull();
    expect(screen.getByRole('button', { name: 'Link work' })).toBeDefined();
  });

  it('renders every linked issue and opens it externally instead of routing to the PR lens', () => {
    store.sessionGithub = {
      'sess-1': {
        linkedIssues: [
          { number: 7, title: 'First issue', url: 'https://github.com/acme/repo/issues/7' },
          { number: 9, title: 'Second issue', url: 'https://github.com/acme/repo/issues/9' },
        ],
      },
    };

    const onSelectLens = vi.fn();
    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={onSelectLens} />);

    expect(screen.getByText('#7')).toBeDefined();
    expect(screen.getByText('First issue')).toBeDefined();
    expect(screen.getByText('#9')).toBeDefined();
    expect(screen.getByText('Second issue')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /#9 Second issue/i }));
    expect(onSelectLens).not.toHaveBeenCalled();
    expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/acme/repo/issues/9');

    const secondIssueRow = screen.getByRole('button', { name: /#9 Second issue/i }).closest('div');
    expect(secondIssueRow).not.toBeNull();
    fireEvent.click(within(secondIssueRow!).getByRole('link', { name: 'Open in GitHub' }));
    expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/acme/repo/issues/9');
  });

  it('routes every external task to its provider lens', () => {
    store.sessionExternalTasks = {
      'sess-1': [
        {
          sessionId: 'sess-1',
          provider: 'gitlab',
          externalId: 'gitlab-3',
          identifier: 'acme/repo#3',
          url: 'https://gitlab.com/acme/repo/-/issues/3',
          title: 'GitLab task',
          createdAt: '2026-07-21T10:00:00.000Z',
        } as SessionExternalTask,
        {
          sessionId: 'sess-1',
          provider: 'linear',
          externalId: 'linear-42',
          identifier: 'ENG-42',
          url: 'https://linear.app/acme/issue/ENG-42',
          title: 'Track linked work',
          createdAt: '2026-07-21T10:00:00.000Z',
        } as SessionExternalTask,
        {
          sessionId: 'sess-1',
          provider: 'sentry',
          externalId: 'sentry-7',
          identifier: 'GOODBOY-7',
          url: 'https://sentry.io/organizations/acme/issues/7/',
          title: 'TypeError',
          createdAt: '2026-07-21T10:00:00.000Z',
        } as SessionExternalTask,
      ],
    };
    const onSelectLens = vi.fn();

    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={onSelectLens} />);

    expect(screen.getByText('ENG-42')).toBeDefined();
    expect(screen.getByText('Track linked work')).toBeDefined();
    expect(screen.getByText('GOODBOY-7')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open ENG-42 integration' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open GOODBOY-7 integration' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open acme/repo#3 integration' }));
    expect(onSelectLens.mock.calls).toEqual([['linear'], ['sentry'], ['gitlab_issues']]);
  });

  it('navigates from the link menu to each provider lens', () => {
    const onSelectLens = vi.fn();
    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: 'Link work' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Linear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link work' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sentry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link work' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'GitLab issues' }));

    expect(onSelectLens.mock.calls).toEqual([['linear'], ['sentry'], ['gitlab_issues']]);
  });

  it('shows a task repository only in a composite workspace', () => {
    const sessionId = 'sess-1' as SessionId;
    const compositeId = 'workspace-product' as WorkspaceId;
    const memberId = 'workspace-web' as WorkspaceId;
    store.sessions = [{ id: sessionId, workspaceId: compositeId } as Session];
    store.workspaces = [
      {
        id: compositeId,
        name: 'Product',
        rootPath: '/tmp/product',
        kind: 'composite',
        members: [{ workspaceId: memberId, rootPath: '/tmp/web', mountName: 'web' }],
        createdAt: '2026-07-21T10:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-07-21T10:00:00.000Z' as IsoDateTime,
      },
    ];
    store.sessionExternalTasks = {
      [sessionId]: [
        {
          sessionId,
          mountWorkspaceId: memberId,
          provider: 'github',
          externalId: '42',
          identifier: '#42',
          url: 'https://github.com/acme/web/pull/42',
          title: 'Review web',
          createdAt: '2026-07-21T10:00:00.000Z',
        } as SessionExternalTask,
      ],
    };

    render(<LinkedWorkSection sessionId={sessionId} onSelectLens={vi.fn()} />);

    expect(screen.getByText('web')).toBeDefined();
  });

  it('keeps the link hub visible when no linked work exists', () => {
    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={vi.fn()} />);

    expect(screen.getByText('Linked work')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Link work' })).toBeDefined();
  });
});
