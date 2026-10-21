// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ListGrid } from '../components/ListGrid/ListGrid';
import { ListGridGroup } from '../components/ListGrid/ListGridGroup';
import { ListGridRow } from '../components/ListGrid/ListGridRow';
import type { ListGridColumn } from '../components/ListGrid/listGridTemplate';
import { StateDot } from '../components/StateDot';

afterEach(cleanup);

const COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'state', width: 16 },
  { key: 'role', width: 96 },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'time', width: 56, align: 'end', isNumeric: true, tone: 'hint' },
];

const ROWS = [
  { id: 'a', role: 'Implementer', title: 'Speed up the ledger export', time: '1:12' },
  { id: 'b', role: 'CI fixer', title: 'Fix the payments-api checks', time: '12:40' },
];

type RenderParams = {
  readonly onSelect: (id: string) => void;
};

const renderGrid = ({ onSelect }: RenderParams) =>
  render(
    <ListGrid label="Agents" columns={COLUMNS}>
      {ROWS.map((row) => (
        <ListGridRow
          key={row.id}
          isSelected={row.id === 'a'}
          onSelect={() => onSelect(row.id)}
          cells={[
            <StateDot key="dot" state="running" label="Working" isLive />,
            row.role,
            row.title,
            row.time,
          ]}
        />
      ))}
    </ListGrid>,
  );

describe('ListGrid', () => {
  it('shares one column template with fixed leading and trailing columns and a fill title', () => {
    renderGrid({ onSelect: () => undefined });
    const list = screen.getByRole('list', { name: 'Agents' });
    expect(list.style.gridTemplateColumns).toBe('0px 16px 96px minmax(0,1fr) 56px 0px');
    for (const item of within(list).getAllByRole('listitem')) {
      expect(item.className).toContain('grid-cols-subgrid');
    }
  });

  it('caps a shrinkable column at its width and lets it give way in a narrow column', () => {
    render(
      <ListGrid
        label="Branches"
        columns={[
          { key: 'branch', width: 232, isTitle: true, isShrinkable: true },
          { key: 'track', width: 80 },
          { key: 'detail', width: 'fill' },
        ]}
      >
        <ListGridRow cells={['hl/feat-center-home-page', 'track', 'Ready to merge']} />
      </ListGrid>,
    );
    expect(screen.getByRole('list', { name: 'Branches' }).style.gridTemplateColumns).toBe(
      '0px minmax(0,232px) 80px minmax(0,1fr) 0px',
    );
  });

  it('starts the first cell after the edge track and right aligns numbers in tabular figures', () => {
    renderGrid({ onSelect: () => undefined });
    const [first] = screen.getAllByRole('button');
    const cells = first?.querySelectorAll('[data-list-grid-cell]') ?? [];
    expect(cells[0]?.className).toContain('col-start-2');
    expect(cells[3]?.className).toContain('justify-self-end');
    expect(cells[3]?.className).toContain('tabular-nums');
    expect(cells[2]?.className).toContain('text-row');
  });

  it('makes the row the button and marks the selected row', () => {
    const onSelect = vi.fn();
    renderGrid({ onSelect });
    const first = screen.getByRole('button', { name: /Implementer/ });
    const second = screen.getByRole('button', { name: /CI fixer/ });
    expect(first.getAttribute('aria-current')).toBe('true');
    expect(second.getAttribute('aria-current')).toBeNull();
    fireEvent.click(second);
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('moves focus between rows with the arrow keys and stops at the ends', () => {
    renderGrid({ onSelect: () => undefined });
    const first = screen.getByRole('button', { name: /Implementer/ });
    const second = screen.getByRole('button', { name: /CI fixer/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });

  it('renders a row without an action as plain content, never a button', () => {
    render(
      <ListGrid label="Checks" columns={COLUMNS}>
        <ListGridRow cells={['', 'Tester', 'test (payments-api)', '0:52']} />
      </ListGrid>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    screen.getByText('test (payments-api)');
  });

  it('drops a column that hides when empty from the template when no row fills it', () => {
    const columns: ReadonlyArray<ListGridColumn> = [
      { key: 'title', width: 'fill', isTitle: true },
      { key: 'port', width: 56, shouldHideWhenEmpty: true },
      { key: 'time', width: 56, align: 'end' },
    ];
    render(
      <ListGrid label="Scripts" columns={columns}>
        <ListGridRow cells={['dev server', null, '2m']} />
        <ListGridRow cells={['lint', '', '8s']} />
      </ListGrid>,
    );
    const list = screen.getByRole('list', { name: 'Scripts' });
    expect(list.style.gridTemplateColumns).toBe('0px minmax(0,1fr) 56px 0px');
    expect(list.querySelectorAll('[data-list-grid-cell="port"]')).toHaveLength(0);
    expect(list.querySelector('[data-list-grid-cell="title"]')?.className).toContain('col-start-2');
  });

  it('keeps a hiding column on every row as soon as one row fills it', () => {
    const columns: ReadonlyArray<ListGridColumn> = [
      { key: 'title', width: 'fill', isTitle: true },
      { key: 'port', width: 56, shouldHideWhenEmpty: true },
    ];
    const { rerender } = render(
      <ListGrid label="Scripts" columns={columns}>
        <ListGridRow key="dev" cells={['dev server', null]} />
        <ListGridRow key="api" cells={['api', ':4318']} />
      </ListGrid>,
    );
    const list = screen.getByRole('list', { name: 'Scripts' });
    expect(list.style.gridTemplateColumns).toBe('0px minmax(0,1fr) 56px 0px');
    expect(list.querySelectorAll('[data-list-grid-cell="port"]')).toHaveLength(2);
    rerender(
      <ListGrid label="Scripts" columns={columns}>
        <ListGridRow key="dev" cells={['dev server', null]} />
      </ListGrid>,
    );
    expect(list.style.gridTemplateColumns).toBe('0px minmax(0,1fr) 0px');
  });

  it('names a group by its heading and puts its count right after the name', () => {
    render(
      <ListGrid label="Tasks" columns={COLUMNS} isGrouped>
        <ListGridGroup label="In progress" count={12}>
          <ListGridRow cells={['', 'HBL-412', 'Ledger export times out', '2h']} />
        </ListGridGroup>
      </ListGrid>,
    );
    const group = screen.getByRole('list', { name: 'In progress' });
    within(group).getByText('Ledger export times out');
    const heading = screen.getByRole('heading', { name: 'In progress' });
    expect(heading.nextElementSibling?.textContent).toBe('12');
    expect(screen.getByRole('list', { name: 'Tasks' }).className).toContain('gap-y-4');
  });

  it('keeps the count beside the name and the group action after them', () => {
    render(
      <ListGrid label="Tasks" columns={COLUMNS} isGrouped>
        <ListGridGroup label="In progress" count={12} action={<button type="button">Open</button>}>
          <ListGridRow cells={['', 'HBL-412', 'Ledger export times out', '2h']} />
        </ListGridGroup>
      </ListGrid>,
    );
    const action = screen.getByRole('button', { name: 'Open' });
    const count = screen.getByText('12');
    expect(count.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(count.previousElementSibling?.textContent).toBe('In progress');
  });

  it('shows the count from two rows and puts the fold word right after it', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <ListGrid label="Tasks" columns={COLUMNS} isGrouped>
        <ListGridGroup label="Starred" count={1}>
          <ListGridRow cells={['', 'HBL-412', 'Ledger export times out', '2h']} />
        </ListGridGroup>
        <ListGridGroup label="Linear" count={411} fold={{ label: 'Show all', onToggle }}>
          <ListGridRow cells={['', 'HBL-398', 'Settlement dates', '5d']} />
        </ListGridGroup>
      </ListGrid>,
    );
    const counts = Array.from(container.querySelectorAll('[data-list-grid-count]'));
    expect(counts.map((count) => count.textContent)).toEqual(['411']);
    const fold = screen.getByRole('button', { name: 'Show all' });
    expect(counts[0]?.nextElementSibling).toBe(fold);
    fireEvent.click(fold);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('puts the group mark right before the name, and none without one', () => {
    const { container } = render(
      <ListGrid label="Sessions" columns={COLUMNS} isGrouped>
        <ListGridGroup
          label="Running"
          count={2}
          mark={<StateDot state="running" label="Running" />}
        >
          <ListGridRow cells={['', 'HBL-412', 'Ledger export times out', '2h']} />
          <ListGridRow cells={['', 'HBL-398', 'Settlement dates', '5d']} />
        </ListGridGroup>
        <ListGridGroup label="Done" count={1}>
          <ListGridRow cells={['', 'HBL-377', 'Refund rounding', '9d']} />
        </ListGridGroup>
      </ListGrid>,
    );
    const marks = Array.from(container.querySelectorAll('[data-list-grid-group-mark]'));
    expect(marks).toHaveLength(1);
    const label = container.querySelector('[data-list-grid-group-label]');
    const heading = screen.getByRole('heading', { name: 'Running' });
    expect(label?.contains(marks[0] ?? null)).toBe(true);
    expect(marks[0]?.nextElementSibling).toBe(heading);
    expect(
      screen.getByRole('img', { name: 'Running' }).closest('[data-list-grid-group-mark]'),
    ).toBe(marks[0]);
  });

  it('draws a group with no name as rows alone, with no heading and no count', () => {
    const { container } = render(
      <ListGrid label="Sessions" columns={COLUMNS} isGrouped>
        <ListGridGroup>
          <ListGridRow cells={['', 'HBL-412', 'Ledger export times out', '2h']} />
        </ListGridGroup>
        <ListGridGroup label="Inactive" count={1}>
          <ListGridRow cells={['', 'HBL-398', 'Settlement dates', 'inactive 5d']} />
        </ListGridGroup>
      </ListGrid>,
    );
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Inactive',
    ]);
    expect(container.querySelectorAll('[data-list-grid-group-label]')).toHaveLength(1);
    expect(screen.getByText('Ledger export times out')).toBeDefined();
  });
});

describe('StateDot', () => {
  it('names its state and pulses only on the item the caller marks live', () => {
    render(
      <>
        <StateDot state="running" label="Working" isLive />
        <StateDot state="running" label="2 running" />
        <StateDot state="needsYou" label="Needs you" isLive />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Working' }).className).toContain('animate-soft-pulse');
    expect(screen.getByRole('img', { name: '2 running' }).className).not.toContain(
      'animate-soft-pulse',
    );
    expect(screen.getByRole('img', { name: 'Needs you' }).className).not.toContain(
      'animate-soft-pulse',
    );
  });

  it('draws idle and stopped as a ring with a transparent fill', () => {
    render(
      <>
        <StateDot state="idle" label="Idle" />
        <StateDot state="stopped" label="Stopped" />
        <StateDot state="done" label="Done" />
      </>,
    );
    for (const name of ['Idle', 'Stopped']) {
      const dot = screen.getByRole('img', { name });
      expect(dot.className).toContain('bg-transparent');
      expect(dot.className).toContain('ring-1');
    }
    expect(screen.getByRole('img', { name: 'Done' }).className).toContain('bg-success');
  });
});
