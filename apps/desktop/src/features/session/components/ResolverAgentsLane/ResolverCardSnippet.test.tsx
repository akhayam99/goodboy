// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DiffComment, PrComment } from '@goodboy/types';
import { ResolverCardSnippet } from './ResolverCardSnippet';

const threadComment: PrComment = {
  id: 'c1',
  author: 'cursor[bot]',
  authorAvatarUrl: null,
  body: '### Missing UI language forcing **Medium Severity**\n\n```suggestion\n+  ok\n```',
  createdAt: '2026-05-28T00:00:00Z',
  url: 'https://github.com/x/y/pull/1#c1',
  source: 'review',
  path: 'src/App.tsx',
  line: 12,
};

const diffComment: DiffComment = {
  id: 'd1',
  sessionId: 'sess-1' as DiffComment['sessionId'],
  filePath: 'src/App.tsx',
  body: 'use the constant here instead',
  status: 'open',
  createdAt: '2026-05-28T00:00:00Z' as DiffComment['createdAt'],
};

describe('ResolverCardSnippet', () => {
  it('renders the thread comment normalized to plain text when present', () => {
    render(<ResolverCardSnippet threadComment={threadComment} diffComment={null} />);
    expect(screen.getByText('Missing UI language forcing Medium Severity')).toBeTruthy();
    expect(screen.queryByText(/suggestion/)).toBeNull();
  });

  it('falls back to the diff comment when there is no thread comment', () => {
    render(<ResolverCardSnippet threadComment={null} diffComment={diffComment} />);
    expect(screen.getByText('use the constant here instead')).toBeTruthy();
  });

  it('renders nothing when both comments are missing', () => {
    const { container } = render(<ResolverCardSnippet threadComment={null} diffComment={null} />);
    expect(container.firstChild).toBeNull();
  });
});
