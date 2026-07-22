// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionExternalTask, SessionId } from '@goodboy/types';

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
  sessionGitlabMr: Record<
    string,
    {
      mr?: {
        iid: number;
        title: string;
        state: string;
        draft: boolean;
      } | null;
    }
  >;
  sessionExternalTasks: Record<string, ReadonlyArray<SessionExternalTask>>;
};

const { store, mocks } = vi.hoisted(() => ({
  store: {
    sessionGithub: {},
    sessionGitlabMr: {},
    sessionExternalTasks: {},
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
  store.sessionGitlabMr = {};
  store.sessionExternalTasks = {};
  mocks.openUrl.mockClear();
});

afterEach(cleanup);

describe('LinkedWorkSection', () => {
  it('renders a pull request with its state and unresolved review count', () => {
    store.sessionGithub = {
      'sess-1': {
        pr: { number: 42, title: 'Ship linked work', state: 'open' },
        detail: {
          comments: [
            { source: 'review', resolved: false },
            { source: 'review', resolved: false },
            { source: 'review', resolved: true },
            { source: 'issue', resolved: false },
          ],
        },
      },
    };
    const onSelectLens = vi.fn();

    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={onSelectLens} />);

    expect(screen.getByText('#42')).toBeDefined();
    expect(screen.getByText('Ship linked work')).toBeDefined();
    expect(screen.getByText('In review · 2 unresolved')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /#42 Ship linked work/i }));
    expect(onSelectLens).toHaveBeenCalledWith('pr');
  });

  it('renders a merge request and routes it to the pull request lens', () => {
    store.sessionGitlabMr = {
      'sess-1': {
        mr: { iid: 17, title: 'GitLab work', state: 'opened', draft: true },
      },
    };
    const onSelectLens = vi.fn();

    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={onSelectLens} />);

    expect(screen.getByText('!17')).toBeDefined();
    expect(screen.getByText('GitLab work')).toBeDefined();
    expect(screen.getByText('Draft')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /!17 GitLab work/i }));
    expect(onSelectLens).toHaveBeenCalledWith('pr');
  });

  it('renders every linked issue and opens its external URL', () => {
    store.sessionGithub = {
      'sess-1': {
        linkedIssues: [
          { number: 7, title: 'First issue', url: 'https://github.com/acme/repo/issues/7' },
          { number: 9, title: 'Second issue', url: 'https://github.com/acme/repo/issues/9' },
        ],
      },
    };

    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={vi.fn()} />);

    expect(screen.getByText('#7')).toBeDefined();
    expect(screen.getByText('First issue')).toBeDefined();
    expect(screen.getByText('#9')).toBeDefined();
    expect(screen.getByText('Second issue')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /#9 Second issue/i }));
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
    fireEvent.click(screen.getByRole('button', { name: 'open ENG-42 integration' }));
    fireEvent.click(screen.getByRole('button', { name: 'open GOODBOY-7 integration' }));
    fireEvent.click(screen.getByRole('button', { name: 'open acme/repo#3 integration' }));
    expect(onSelectLens.mock.calls).toEqual([['linear'], ['sentry'], ['gitlab_issues']]);
  });

  it('navigates from the link menu to each provider lens', () => {
    const onSelectLens = vi.fn();
    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: 'link work' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Linear' }));
    fireEvent.click(screen.getByRole('button', { name: 'link work' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sentry' }));
    fireEvent.click(screen.getByRole('button', { name: 'link work' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'GitLab issues' }));

    expect(onSelectLens.mock.calls).toEqual([['linear'], ['sentry'], ['gitlab_issues']]);
  });

  it('keeps the link hub visible when no linked work exists', () => {
    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={vi.fn()} />);

    expect(screen.getByText('No linked work yet.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'link work' })).toBeDefined();
  });
});
