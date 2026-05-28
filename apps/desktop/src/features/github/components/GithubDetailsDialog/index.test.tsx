// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    sessionGithub: {} as Record<string, unknown>,
    refreshSessionPrDetail: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('../../../chat/spawn-from-comment', () => ({
  buildCommentAgentArgs: () => ({
    name: 'x',
    model: 'm',
    effort: 'low',
    initialPrompt: '',
    kind: 'resolver',
  }),
}));

beforeEach(() => {
  state.sessionGithub = {};
  state.refreshSessionPrDetail = vi.fn(async () => undefined);
});
afterEach(cleanup);

import { GithubDetailsDialog } from './index';

describe('GithubDetailsDialog', () => {
  it('renders the empty-state when no PR is linked to the session', () => {
    render(<GithubDetailsDialog open onClose={vi.fn()} sessionId={'sess-1' as never} />);
    expect(screen.getByText(/no pull request linked/i)).toBeDefined();
  });

  it('renders the PR header when a PR is linked', () => {
    state.sessionGithub = {
      'sess-1': {
        pr: {
          number: 42,
          title: 'tiny pr',
          url: 'https://github.com/x/y/pull/42',
          state: 'open',
          checks: 'success',
          reviewDecision: null,
        },
        detail: null,
        detailLoading: false,
        detailError: null,
      },
    };
    render(<GithubDetailsDialog open onClose={vi.fn()} sessionId={'sess-1' as never} />);
    expect(screen.getByText('#42')).toBeDefined();
    expect(screen.getByText('tiny pr')).toBeDefined();
  });
});
