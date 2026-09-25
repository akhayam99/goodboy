// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';
import type { MultiSelect } from '../../../../../shared/hooks/useMultiSelect';
import type { BoardNavigation } from '../useBoardNavigation';

vi.mock('../StageBoardCard', () => ({
  StageBoardCard: ({
    session,
    selected,
    onModifierClick,
  }: {
    readonly session: Session;
    readonly selected?: boolean;
    readonly onModifierClick?: (id: SessionId, event: { readonly altKey: boolean }) => void;
  }) => (
    <button
      type="button"
      aria-pressed={selected === true}
      aria-label={`card ${session.goal}`}
      onClick={(event) => onModifierClick?.(session.id as SessionId, event)}
    />
  ),
}));

import { StageColumn, type ColumnCollapse } from './index';

const nav = {} as BoardNavigation;

const makeSession = (id: string, goal: string): Session =>
  ({ id: id as SessionId, goal }) as unknown as Session;

const noop = () => undefined;

const makeSelection = (over: Partial<MultiSelect<SessionId>> = {}): MultiSelect<SessionId> => ({
  selected: [],
  isSelected: () => false,
  toggle: noop,
  selectRange: noop,
  selectAll: noop,
  clear: noop,
  selectIds: noop,
  handleItemClick: noop,
  ...over,
});

const renderColumn = (
  sessions: ReadonlyArray<Session>,
  selection: MultiSelect<SessionId> = makeSelection(),
  spec: Parameters<typeof StageColumn>[0]['spec'] = { kind: 'stage', stage: 'building' },
  collapse?: ColumnCollapse,
) =>
  render(
    <StageColumn
      spec={spec}
      sessions={sessions}
      nav={nav}
      selection={selection}
      onArchive={noop}
      onDelete={noop}
      onRestore={noop}
      collapse={collapse}
    />,
  );

afterEach(cleanup);

describe('StageColumn', () => {
  it('teaches what lands in an empty column, without a count', () => {
    const { container } = renderColumn([], makeSelection(), {
      kind: 'stage',
      stage: 'attention',
    });
    expect(screen.getByText('needs you')).toBeDefined();
    expect(screen.getByText('Nothing needs you')).toBeDefined();
    expect(screen.getByText(/when an agent asks you something/)).toBeDefined();
    expect(container.querySelector('.tabular-nums')).toBeNull();
  });

  it('renders the count and stage label once the column has cards', () => {
    renderColumn([makeSession('s-1', 'one')]);
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('building')).toBeDefined();

    cleanup();
    renderColumn([makeSession('s-1', 'one')], makeSelection(), {
      kind: 'stage',
      stage: 'running',
    });
    expect(screen.getByText('running')).toBeDefined();
  });

  it('offers a collapse control only on a folding column', () => {
    renderColumn([makeSession('s-1', 'one')]);
    expect(screen.queryByRole('button', { name: /sessions?$/ })).toBeNull();

    cleanup();
    const onCollapse = vi.fn();
    renderColumn(
      [makeSession('s-1', 'one')],
      makeSelection(),
      { kind: 'stage', stage: 'done' },
      { label: 'Done, 1 session', onCollapse },
    );
    const button = screen.getByRole('button', { name: 'Done, 1 session' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe('board-column-done');
    expect(button.id).toBe('board-collapse-done');
    expect(button.hasAttribute('title')).toBe(false);
    expect(screen.getByRole('button', { name: 'card one' })).toBeDefined();

    fireEvent.click(button);
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it('holds every column at the fixed board width', () => {
    const { container } = renderColumn(
      [],
      makeSelection(),
      { kind: 'archived' },
      { label: 'Archived, 0 sessions', onCollapse: noop },
    );
    const column = container.querySelector('#board-column-archived');
    expect(column?.className).toContain('w-72');
    expect(column?.className).toContain('motion-safe:starting:w-11');
    expect(screen.getByText('Nothing archived')).toBeDefined();
  });

  it('marks the cards the board selection owns', () => {
    renderColumn(
      [makeSession('s-1', 'one'), makeSession('s-2', 'two')],
      makeSelection({ isSelected: (id) => id === ('s-2' as SessionId) }),
    );

    expect(screen.getByRole('button', { name: 'card one' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'card two' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('routes a modifier click straight to the board selection', () => {
    const handleItemClick = vi.fn();
    renderColumn([makeSession('s-1', 'one')], makeSelection({ handleItemClick }));

    fireEvent.click(screen.getByRole('button', { name: 'card one' }), { altKey: true });

    expect(handleItemClick).toHaveBeenCalledWith('s-1', expect.anything());
  });
});
