// @vitest-environment happy-dom

import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    upsertSessionSlot: vi.fn(async () => undefined),
    loadGoalAttachments: vi.fn(async () => undefined),
    removeGoalAttachment: vi.fn(async () => undefined),
    sessionAttachments: {},
    workflowRunAttachments: {},
    sessionWorktrees: {},
    currentSessionId: null,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof store) => T) => selector(store),
  EMPTY_ARRAY: [],
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    Tooltip: ({ content, children }: { content: string; children: ReactElement }) => (
      <span data-tooltip={content}>{children as ReactNode}</span>
    ),
  };
});

import { GoalOverviewRegion } from './GoalOverviewRegion';

const SESSION_ID = 'sess-1' as SessionId;

type RenderParams = {
  readonly value?: string;
  readonly historyCount?: number;
  readonly onOpenHistory?: () => void;
};

const renderRegion = ({
  value = 'Ship the parser rewrite',
  historyCount = 2,
  onOpenHistory = vi.fn(),
}: RenderParams = {}) =>
  render(
    <GoalOverviewRegion
      sessionId={SESSION_ID}
      value={value}
      historyCount={historyCount}
      isLoading={false}
      isSummarizing={false}
      onOpenHistory={onOpenHistory}
    />,
  );

beforeEach(() => {
  store.upsertSessionSlot.mockClear();
});
afterEach(cleanup);

describe('GoalOverviewRegion', () => {
  it('keeps the text and its controls on one row that truncates instead of wrapping', () => {
    renderRegion();
    const text = screen.getByRole('button', { name: 'Edit goal' });

    expect(text.className).toContain('truncate');
    expect(text.parentElement?.parentElement?.className).toContain('items-center');
  });

  it('enters edit from a click on the text, with no edit button', () => {
    renderRegion();

    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    expect(screen.getByRole('textbox', { name: 'Goal' })).toBeDefined();
  });

  it('reaches edit from the keyboard', () => {
    renderRegion();
    const text = screen.getByRole('button', { name: 'Edit goal' });

    expect(text.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(text, { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: 'Goal' })).toBeDefined();
  });

  it('does not enter edit when the click ended a text selection', () => {
    renderRegion();
    const selection = { isCollapsed: false, toString: () => 'parser' };
    const original = window.getSelection;
    window.getSelection = () => selection as unknown as Selection;
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    window.getSelection = original;

    expect(screen.queryByRole('textbox', { name: 'Goal' })).toBeNull();
  });

  it('keeps only copy and history on the right', () => {
    const onOpenHistory = vi.fn();
    renderRegion({ onOpenHistory });

    expect(screen.getByRole('button', { name: /copy goal/i })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /2 previous versions of Goal/i }));
    expect(onOpenHistory).toHaveBeenCalledOnce();
  });

  it('saves the edit on the platform commit chord', () => {
    renderRegion();
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    const input = screen.getByRole('textbox', { name: 'Goal' });
    fireEvent.change(input, { target: { value: 'Ship the parser' } });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

    expect(store.upsertSessionSlot).toHaveBeenCalledWith(SESSION_ID, 'goal', 'Ship the parser');
  });

  it('keeps a bare Enter free to type a newline, so a multi-line goal survives editing', () => {
    renderRegion({ value: 'Ship the parser\n\n- keep the old lexer\n- land behind a flag' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    const input = screen.getByRole('textbox', { name: 'Goal' });

    expect((input as HTMLTextAreaElement).value).toContain('\n- keep the old lexer');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(store.upsertSessionSlot).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(store.upsertSessionSlot).not.toHaveBeenCalled();
  });
});
