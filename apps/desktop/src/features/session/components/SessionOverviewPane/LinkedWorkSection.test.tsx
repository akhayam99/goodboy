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
  sessionExternalTasks: Record<string, SessionExternalTask>;
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

    expect(screen.getByText('#42 Ship linked work')).toBeDefined();
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

    expect(screen.getByText('#17 GitLab work')).toBeDefined();
    expect(screen.getByText('Draft')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /#17 GitLab work/i }));
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

    expect(screen.getByText('#7 First issue')).toBeDefined();
    expect(screen.getByText('#9 Second issue')).toBeDefined();
    expect(screen.getAllByText('linked issue')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /#9 Second issue/i }));
    expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/acme/repo/issues/9');
  });

  it('renders the full external task chip with its default studio action', () => {
    store.sessionExternalTasks = {
      'sess-1': {
        sessionId: 'sess-1',
        provider: 'linear',
        externalId: 'linear-42',
        identifier: 'ENG-42',
        url: 'https://linear.app/acme/issue/ENG-42',
        title: 'Track linked work',
        createdAt: '2026-07-21T10:00:00.000Z',
      } as SessionExternalTask,
    };
    const handler = vi.fn();
    window.addEventListener('goodboy:open-linear-studio', handler);

    render(<LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={vi.fn()} />);

    expect(screen.getByText('ENG-42')).toBeDefined();
    expect(screen.getByText('Track linked work')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'open ENG-42 in Linear studio' }));
    expect(handler).toHaveBeenCalledOnce();
    expect((handler.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      issueExternalId: 'linear-42',
    });
    window.removeEventListener('goodboy:open-linear-studio', handler);
  });

  it('returns null when no linked work exists', () => {
    const { container } = render(
      <LinkedWorkSection sessionId={'sess-1' as SessionId} onSelectLens={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
