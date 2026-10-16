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
            <StateDot key="dot" state="running" label="Working" />,
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

  it('names a group by its heading and puts its count in the last column', () => {
    render(
      <ListGrid label="Tasks" columns={COLUMNS} isGrouped>
        <ListGridGroup label="In progress" count={12}>
          <ListGridRow cells={['', 'HBL-412', 'Ledger export times out', '2h']} />
        </ListGridGroup>
      </ListGrid>,
    );
    const group = screen.getByRole('list', { name: 'In progress' });
    within(group).getByText('Ledger export times out');
    expect(screen.getByText('12').className).toContain('col-start-[-3]');
    expect(screen.getByRole('list', { name: 'Tasks' }).className).toContain('gap-y-4');
  });

  it('keeps a group action beside its name and the count alone in the last column', () => {
    render(
      <ListGrid label="Tasks" columns={COLUMNS} isGrouped>
        <ListGridGroup label="In progress" count={12} action={<button type="button">Open</button>}>
          <ListGridRow cells={['', 'HBL-412', 'Ledger export times out', '2h']} />
        </ListGridGroup>
      </ListGrid>,
    );
    const action = screen.getByRole('button', { name: 'Open' });
    expect(action.parentElement?.className).toContain('col-end-[-3]');
    expect(screen.getByText('12').textContent).toBe('12');
  });
});

describe('StateDot', () => {
  it('names its state and pulses only while running', () => {
    render(
      <>
        <StateDot state="running" label="Working" />
        <StateDot state="needsYou" label="Needs you" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Working' }).className).toContain('animate-soft-pulse');
    expect(screen.getByRole('img', { name: 'Needs you' }).className).not.toContain(
      'animate-soft-pulse',
    );
  });
});
