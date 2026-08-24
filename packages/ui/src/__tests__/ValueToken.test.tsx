// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ValueToken } from '../components/ValueToken';

afterEach(cleanup);

describe('ValueToken', () => {
  it('renders the value in mono on a neutral fill, with no tone of its own', () => {
    render(<ValueToken value="ak/feat-timeline" />);

    const classes = screen.getByText('ak/feat-timeline').className;
    expect(classes).toContain('font-mono');
    expect(classes).toContain('bg-muted');
    expect(classes).not.toContain('text-success');
    expect(classes).not.toContain('text-danger');
  });

  it('truncates instead of wrapping the row it sits in', () => {
    render(<ValueToken value="/Users/dev/repo/worktrees/a-very-long-session-folder" />);

    const classes = screen.getByText(
      '/Users/dev/repo/worktrees/a-very-long-session-folder',
    ).className;
    expect(classes).toContain('truncate');
    expect(classes).toContain('min-w-0');
    expect(classes).toContain('max-w-full');
  });

  it('carries the full value as its hover title, so truncation loses nothing', () => {
    render(<ValueToken value="goodboy/untitled" />);

    expect(screen.getByText('goodboy/untitled').getAttribute('title')).toBe('goodboy/untitled');
  });

  it('takes an explicit title when the value alone would not explain itself', () => {
    render(<ValueToken value="#42" title="Pull request #42" />);

    expect(screen.getByText('#42').getAttribute('title')).toBe('Pull request #42');
  });
});
