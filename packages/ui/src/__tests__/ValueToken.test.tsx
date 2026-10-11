// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ValueToken } from '../components/ValueToken';

afterEach(cleanup);

const cut = ({ element }: { readonly element: HTMLElement }): HTMLElement => {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: 240 });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: 120 });
  return element;
};

const hoverTip = ({ element }: { readonly element: HTMLElement }): string | null => {
  vi.useFakeTimers();
  fireEvent.mouseEnter(element);
  act(() => {
    vi.advanceTimersByTime(400);
  });
  vi.useRealTimers();
  return screen.queryByRole('tooltip')?.textContent ?? null;
};

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

  it('shows the full value in a tooltip once truncation cuts it, never as a native title', () => {
    render(<ValueToken value="goodboy/untitled" />);
    const token = cut({ element: screen.getByText('goodboy/untitled') });

    expect(token.getAttribute('title')).toBeNull();
    expect(hoverTip({ element: token })).toBe('goodboy/untitled');
  });

  it('shows no tooltip while the value fits', () => {
    render(<ValueToken value="goodboy/untitled" />);

    expect(hoverTip({ element: screen.getByText('goodboy/untitled') })).toBeNull();
  });

  it('takes an explicit tooltip when the value alone would not explain itself', () => {
    render(<ValueToken value="#42" title="Pull request #42" />);

    expect(hoverTip({ element: cut({ element: screen.getByText('#42') }) })).toBe(
      'Pull request #42',
    );
  });
});
