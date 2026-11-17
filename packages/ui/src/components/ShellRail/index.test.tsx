// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inbox, Mail, RefreshCw } from '../../icons';
import type { ShellRailForm } from './shellRailFormContext';
import { ShellRailItem } from './ShellRailItem';
import { ShellRail } from '.';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type RailParams = {
  readonly form?: ShellRailForm;
  readonly onTasks?: () => void;
};

const renderRail = ({ form, onTasks = vi.fn() }: RailParams) =>
  render(
    <>
      <ShellRail label="Places" {...(form !== undefined && { form })}>
        <ShellRailItem
          id="board"
          icon={Inbox}
          label="Board"
          mark={{ kind: 'count', count: 3, name: '3 need you' }}
          isCurrent
          onSelect={vi.fn()}
        />
        <ShellRailItem
          id="tasks"
          icon={Mail}
          label="Tasks"
          mark={{ kind: 'dot', name: 'new tasks' }}
          shortcut="session.new"
          onSelect={onTasks}
        />
        <ShellRailItem
          id="terminal"
          icon={RefreshCw}
          label="Terminal"
          isPressed
          onSelect={vi.fn()}
        />
      </ShellRail>
      <button type="button">Outside</button>
    </>,
  );

const railOf = () => screen.getByRole('navigation', { name: 'Places' });

type WidthParams = {
  readonly width: number;
};

const stubWindowWidth = ({ width }: WidthParams) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width <= Number.parseFloat(query.replace('(max-width:', '')),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

describe('ShellRail', () => {
  it('marks the current place and never selects it again', () => {
    const onBoard = vi.fn();
    render(
      <ShellRail label="Places" form="wide">
        <ShellRailItem id="board" icon={Inbox} label="Board" isCurrent onSelect={onBoard} />
      </ShellRail>,
    );
    const board = within(railOf()).getByRole('button', { name: 'Board' });
    expect(board.getAttribute('aria-current')).toBe('page');
    fireEvent.click(board);
    expect(onBoard).not.toHaveBeenCalled();
  });

  it('presses a tool and selects a place that is not current', () => {
    const onTasks = vi.fn();
    renderRail({ form: 'wide', onTasks });
    const terminal = within(railOf()).getByRole('button', { name: 'Terminal' });
    expect(terminal.getAttribute('aria-pressed')).toBe('true');
    const tasks = within(railOf()).getByRole('button', { name: 'Tasks, new tasks' });
    expect(tasks.getAttribute('aria-pressed')).toBeNull();
    expect(tasks.getAttribute('aria-current')).toBeNull();
    fireEvent.click(tasks);
    expect(onTasks).toHaveBeenCalledTimes(1);
  });

  it('draws the word under the icon and the count on the glyph', () => {
    renderRail({ form: 'wide' });
    const board = within(railOf()).getByRole('button', { name: 'Board, 3 need you' });
    expect(within(board).getByText('Board')).toBeDefined();
    expect(within(board).getByText('3')).toBeDefined();
    expect(railOf().style.width).toBe('64px');
  });

  it('leaves the name bare and draws nothing when the count is zero', () => {
    render(
      <ShellRail label="Places" form="wide">
        <ShellRailItem
          id="board"
          icon={Inbox}
          label="Board"
          mark={{ kind: 'count', count: 0, name: 'nothing needs you' }}
          onSelect={vi.fn()}
        />
      </ShellRail>,
    );
    const board = within(railOf()).getByRole('button', { name: 'Board' });
    expect(within(board).queryByText('0')).toBeNull();
  });

  it('moves focus between the items with the arrows, Home and End', () => {
    renderRail({ form: 'wide' });
    const board = within(railOf()).getByRole('button', { name: 'Board, 3 need you' });
    const tasks = within(railOf()).getByRole('button', { name: 'Tasks, new tasks' });
    const terminal = within(railOf()).getByRole('button', { name: 'Terminal' });
    board.focus();
    fireEvent.keyDown(board, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tasks);
    fireEvent.keyDown(tasks, { key: 'End' });
    expect(document.activeElement).toBe(terminal);
    fireEvent.keyDown(terminal, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(board);
    fireEvent.keyDown(board, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(terminal);
    fireEvent.keyDown(terminal, { key: 'Home' });
    expect(document.activeElement).toBe(board);
  });

  it('leaves keys alone that come from outside an item or carry a modifier', () => {
    renderRail({ form: 'wide' });
    const board = within(railOf()).getByRole('button', { name: 'Board, 3 need you' });
    const outside = screen.getByRole('button', { name: 'Outside' });
    board.focus();
    fireEvent.keyDown(board, { key: 'ArrowDown', metaKey: true });
    expect(document.activeElement).toBe(board);
    fireEvent.keyDown(board, { key: 'Enter' });
    expect(document.activeElement).toBe(board);
    outside.focus();
    fireEvent.keyDown(outside, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(outside);
  });

  it('turns narrow under a 1100px window: icons only, the word in the tooltip', () => {
    stubWindowWidth({ width: 1024 });
    renderRail({});
    expect(railOf().style.width).toBe('44px');
    const tasks = within(railOf()).getByRole('button', { name: 'Tasks, new tasks' });
    expect(within(tasks).queryByText('Tasks')).toBeNull();
    vi.useFakeTimers();
    fireEvent.mouseEnter(tasks);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();
    expect(screen.getByRole('tooltip').textContent).toContain('Tasks, new tasks');
  });

  it('stays wide at 1100px and wider', () => {
    stubWindowWidth({ width: 1100 });
    renderRail({});
    expect(railOf().style.width).toBe('64px');
    expect(within(railOf()).getByText('Tasks')).toBeDefined();
  });
});
