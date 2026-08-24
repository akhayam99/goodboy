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

const originalDescriptors = {
  scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
};

const mockTextMeasurement = ({
  scrollHeight,
  clientHeight,
}: {
  readonly scrollHeight: number;
  readonly clientHeight: number;
}) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => clientHeight,
  });
};

const restoreTextMeasurement = () => {
  if (originalDescriptors.scrollHeight == null) {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
  }
  if (originalDescriptors.scrollHeight != null) {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalDescriptors.scrollHeight);
  }
  if (originalDescriptors.clientHeight == null) {
    Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
  }
  if (originalDescriptors.clientHeight != null) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalDescriptors.clientHeight);
  }
};

describe('GoalOverviewRegion', () => {
  it('clamps the goal text to four lines below the label row', () => {
    renderRegion();
    const text = screen.getByRole('button', { name: 'Edit goal' });

    expect(text.className).toContain('line-clamp-4');
    expect(text.className).not.toContain('truncate');
  });

  it('keeps copy and history inline on the Goal label line', () => {
    renderRegion();
    const copy = screen.getByRole('button', { name: /copy goal/i });
    const history = screen.getByRole('button', { name: /2 previous versions of Goal/i });
    const labelRow = copy.closest('div');

    expect(labelRow?.textContent).toContain('Goal');
    expect(labelRow?.contains(history)).toBe(true);
    expect(labelRow?.contains(screen.getByRole('button', { name: 'Edit goal' }))).toBe(false);
  });

  it('offers Show more only when the goal overflows the clamp, and Show less collapses it back', () => {
    mockTextMeasurement({ scrollHeight: 160, clientHeight: 80 });
    renderRegion();

    const toggle = screen.getByRole('button', { name: 'Show more' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Edit goal' }).className).not.toContain(
      'line-clamp-4',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getByRole('button', { name: 'Edit goal' }).className).toContain('line-clamp-4');
    restoreTextMeasurement();
  });

  it('hides the Show more toggle when the goal fits inside the clamp', () => {
    mockTextMeasurement({ scrollHeight: 80, clientHeight: 80 });
    renderRegion();

    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    restoreTextMeasurement();
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
