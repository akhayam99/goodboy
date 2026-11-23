// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inbox, Mail, RefreshCw } from '../../icons';
import type { ShellRailForm } from './shellRailFormContext';
import { SHELL_RAIL_EDGE_PX, SHELL_RAIL_TILE } from './shellRailGeometry';
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

  it('tints a tile with its tone, in the word too, and keeps motion behind motion-safe', () => {
    render(
      <ShellRail label="Places" form="wide">
        <ShellRailItem
          id="update"
          icon={Inbox}
          label="Update"
          tint="primary"
          isEdged
          isBreathing
          onSelect={vi.fn()}
        />
      </ShellRail>,
    );
    const tile = within(railOf()).getByRole('button', { name: 'Update' });
    expect(tile.className).toContain('bg-primary-subtle');
    expect(tile.className).toContain('text-primary');
    expect(tile.className).toContain('ring-primary-edge');
    expect(tile.className).toContain('motion-safe:animate-arrival-breath');
    expect(tile.className).not.toContain('brand-accent');
    expect(within(railOf()).getByText('Update').className).toContain('text-primary');
  });

  it('draws a ring that fills with the percent and names it', () => {
    render(
      <ShellRail label="Places" form="wide">
        <ShellRailItem
          id="update"
          icon={Inbox}
          label="Update"
          word="25%"
          tint="primary"
          mark={{ kind: 'ring', percent: 25, name: 'downloading, 25%' }}
          onSelect={vi.fn()}
        />
      </ShellRail>,
    );
    within(railOf()).getByRole('button', { name: 'Update, downloading, 25%' });
    expect(
      railOf().querySelector('[data-slot="rail-ring-arc"]')?.getAttribute('stroke-dasharray'),
    ).toBe('25 100');
  });

  it('draws only the track while the size is not known', () => {
    render(
      <ShellRail label="Places" form="wide">
        <ShellRailItem
          id="update"
          icon={Inbox}
          label="Update"
          tint="primary"
          mark={{ kind: 'ring', percent: null, name: 'downloading' }}
          onSelect={vi.fn()}
        />
      </ShellRail>,
    );
    expect(railOf().querySelector('[data-slot="rail-ring"]')).not.toBeNull();
    expect(railOf().querySelector('[data-slot="rail-ring-arc"]')).toBeNull();
  });

  it('draws the word under the icon and the count on the glyph', () => {
    renderRail({ form: 'wide' });
    within(railOf()).getByRole('button', { name: 'Board, 3 need you' });
    within(railOf()).getByText('Board');
    within(railOf()).getByText('3');
    expect(railOf().style.width).toBe('64px');
  });

  it.each<ShellRailForm>(['wide', 'narrow'])(
    'leaves as much space under the last item as above the first, %s',
    (form) => {
      renderRail({ form });
      expect(railOf().style.paddingTop).toBe(`${SHELL_RAIL_EDGE_PX}px`);
      expect(railOf().style.paddingBottom).toBe(railOf().style.paddingTop);
    },
  );

  it('sizes every item button as one rail tile, the slot a passive mark sits in', () => {
    renderRail({ form: 'wide' });
    within(railOf())
      .getAllByRole('button')
      .forEach((button) => expect(button.className.split(' ')).toContain(SHELL_RAIL_TILE));
  });

  it('keeps a wide item without a shortcut free of a tooltip, since the word says it', () => {
    renderRail({ form: 'wide' });
    const board = within(railOf()).getByRole('button', { name: 'Board, 3 need you' });
    vi.useFakeTimers();
    fireEvent.mouseEnter(board);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('draws a short word under the icon and keeps the full name, shown in the tooltip', () => {
    render(
      <ShellRail label="Places" form="wide">
        <ShellRailItem
          id="connections"
          icon={Inbox}
          label="Connections"
          word="Connect"
          onSelect={vi.fn()}
        />
      </ShellRail>,
    );
    const connections = within(railOf()).getByRole('button', { name: 'Connections' });
    within(railOf()).getByText('Connect');
    vi.useFakeTimers();
    fireEvent.mouseEnter(connections);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();
    expect(screen.getByRole('tooltip').textContent).toContain('Connections');
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
    within(railOf()).getByRole('button', { name: 'Board' });
    expect(within(railOf()).queryByText('0')).toBeNull();
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
    expect(within(railOf()).queryByText('Tasks')).toBeNull();
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
    within(railOf()).getByText('Tasks');
  });

  it('draws a count in the tone its mark names, warning by default', () => {
    render(
      <ShellRail label="Places" form="wide">
        <ShellRailItem
          id="a"
          icon={Inbox}
          label="Alpha"
          mark={{ kind: 'count', count: 2, name: '2 broken', tone: 'danger' }}
          onSelect={vi.fn()}
        />
        <ShellRailItem
          id="b"
          icon={Mail}
          label="Beta"
          mark={{ kind: 'count', count: 1, name: '1 waits' }}
          onSelect={vi.fn()}
        />
      </ShellRail>,
    );
    const tones = Array.from(railOf().querySelectorAll('[data-count-badge]'), (badge) =>
      badge.getAttribute('data-count-badge'),
    );
    expect(tones).toEqual(['danger', 'warning']);
  });

  it('says it opens a popover, shows the open state, and holds the tooltip back while open', () => {
    render(
      <ShellRail label="Places" form="wide">
        <ShellRailItem
          id="workspace"
          icon={Inbox}
          label="Switch workspace: Acme"
          word="Acme"
          tooltip="Acme, 1 project"
          shortcut="session.new"
          hasPopup="dialog"
          isExpanded
          isBusy
          onSelect={vi.fn()}
        />
      </ShellRail>,
    );
    const mark = within(railOf()).getByRole('button', { name: 'Switch workspace: Acme' });
    expect(mark.getAttribute('aria-haspopup')).toBe('dialog');
    expect(mark.getAttribute('aria-expanded')).toBe('true');
    expect(mark.getAttribute('aria-busy')).toBe('true');
    vi.useFakeTimers();
    fireEvent.mouseEnter(mark.parentElement ?? mark);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
