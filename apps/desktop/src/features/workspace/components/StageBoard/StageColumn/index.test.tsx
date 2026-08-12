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

import { StageColumn } from './index';

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
    />,
  );

afterEach(cleanup);

describe('StageColumn', () => {
  it('uses the quiet empty state for an empty column', () => {
    const { container } = renderColumn([]);
    expect(screen.getByText('nothing building')).toBeDefined();
    expect(container.querySelector('.size-12')).toBeNull();
    expect(container.querySelector('.text-foreground')).toBeNull();
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

  it('clears the archived selection when the archived column collapses', () => {
    const clear = vi.fn();
    renderColumn([makeSession('s-1', 'one')], makeSelection({ clear }), { kind: 'archived' });
    clear.mockClear();

    fireEvent.click(screen.getByTitle('collapse archived'));

    expect(clear).toHaveBeenCalled();
  });

  it('leaves the active selection alone when a stage column collapses', () => {
    const clear = vi.fn();
    renderColumn([makeSession('s-1', 'one')], makeSelection({ clear }), {
      kind: 'stage',
      stage: 'done',
    });
    clear.mockClear();

    fireEvent.click(screen.getByTitle('collapse done'));

    expect(clear).not.toHaveBeenCalled();
  });
});
