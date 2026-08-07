import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrComment, PullRequestState } from '@goodboy/types';
import { PrConversation } from './PrConversation';

afterEach(cleanup);

const PR = {
  number: 42,
  title: 'Clamp the walls of text',
  url: 'https://github.com/goodboy/goodboy/pull/42',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/clamp-prose',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-07-30T10:00:00Z',
} satisfies PullRequestState;

const LONG_BODY = ['line one of the bot report', 'line two', 'line three', 'line four'].join('\n');

const comment = (over: Partial<PrComment>): PrComment => ({
  id: 'c1',
  author: 'ak',
  authorAvatarUrl: null,
  body: 'a comment',
  createdAt: '2026-07-30T09:00:00Z',
  url: 'https://github.com/goodboy/goodboy/pull/42#discussion_r1',
  source: 'review',
  resolved: false,
  threadId: 't1',
  ...over,
});

const renderConversation = (comments: ReadonlyArray<PrComment>) =>
  render(<PrConversation comments={comments} pr={PR} onOpenUrl={vi.fn()} />);

describe('PrConversation', () => {
  it('collapses a resolved thread to a single disclosure row', () => {
    renderConversation([comment({ resolved: true, body: LONG_BODY })]);
    const row = screen.getByRole('button', { name: 'Resolved thread by ak' });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('line four')).toBeNull();
    fireEvent.click(row);
    expect(screen.getByText(/line four/)).toBeDefined();
  });

  it('clamps a bot body on an open thread but leaves a human body whole', () => {
    renderConversation([
      comment({ id: 'c1', threadId: 't1', author: 'cursor[bot]', body: LONG_BODY }),
      comment({ id: 'c2', threadId: 't2', author: 'ak', body: LONG_BODY }),
    ]);
    expect(screen.getAllByRole('button', { name: 'Show more' }).length).toBe(1);
  });

  it('hides replies behind a count row past two of them', () => {
    renderConversation([
      comment({ id: 'c1', body: 'head' }),
      comment({ id: 'c2', body: 'first reply', createdAt: '2026-07-30T09:01:00Z' }),
      comment({ id: 'c3', body: 'second reply', createdAt: '2026-07-30T09:02:00Z' }),
      comment({ id: 'c4', body: 'third reply', createdAt: '2026-07-30T09:03:00Z' }),
    ]);
    expect(screen.queryByText('third reply')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '3 replies' }));
    expect(screen.getByText('third reply')).toBeDefined();
  });

  it('marks an outdated open thread but not a fresh one', () => {
    renderConversation([
      comment({ id: 'c1', threadId: 't1', outdated: true }),
      comment({ id: 'c2', threadId: 't2', outdated: false }),
    ]);
    expect(screen.getAllByText('Outdated').length).toBe(1);
  });
});
