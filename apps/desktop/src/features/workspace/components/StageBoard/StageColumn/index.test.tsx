// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';
import type { BoardNavigation } from '../useBoardNavigation';

const { state } = vi.hoisted(() => ({
  state: {
    bulkArchiveTask: vi.fn(async () => undefined),
    bulkUnarchiveTask: vi.fn(async () => undefined),
    bulkDeleteTask: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../StageBoardCard', () => ({
  StageBoardCard: ({
    session,
    selected,
    onToggleSelect,
  }: {
    readonly session: Session;
    readonly selected?: boolean;
    readonly onToggleSelect?: (id: SessionId, event: { readonly shiftKey: boolean }) => void;
  }) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected === true}
      aria-label={`select ${session.goal}`}
      onClick={(event) => onToggleSelect?.(session.id as SessionId, event)}
    />
  ),
}));

import { StageColumn } from './index';

const nav = {} as BoardNavigation;

const makeSession = (id: string, goal: string): Session =>
  ({ id: id as SessionId, goal }) as unknown as Session;

const noop = () => undefined;

const renderColumn = (
  sessions: ReadonlyArray<Session>,
  spec: Parameters<typeof StageColumn>[0]['spec'] = { kind: 'stage', stage: 'building' },
) =>
  render(
    <StageColumn
      spec={spec}
      sessions={sessions}
      nav={nav}
      onArchive={noop}
      onDelete={noop}
      onRestore={noop}
    />,
  );

beforeEach(() => {
  state.bulkArchiveTask.mockClear();
  state.bulkUnarchiveTask.mockClear();
  state.bulkDeleteTask.mockClear();
});

afterEach(cleanup);

describe('StageColumn selection', () => {
  it('shows no bulk bar until a card is selected', () => {
    renderColumn([makeSession('s-1', 'one')]);
    expect(screen.queryByText(/selected/)).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'select one' }));
    expect(screen.getByText(/1 selected/)).toBeDefined();
  });

  it('offers Archive for a stage column and confirms before archiving', async () => {
    renderColumn([makeSession('s-1', 'one')]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'select one' }));
    fireEvent.click(screen.getByRole('button', { name: /^Archive \(1\)$/ }));
    const panel = screen.getByRole('group', { name: 'Archive 1 sessions?' });
    expect(state.bulkArchiveTask).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole('button', { name: /^Archive \(1\)$/ }));
    await waitFor(() => expect(state.bulkArchiveTask).toHaveBeenCalledWith(['s-1']));
  });

  it('offers Restore for the archived column', () => {
    renderColumn([makeSession('s-1', 'one')], { kind: 'archived' });
    fireEvent.click(screen.getByTitle('expand archived'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'select one' }));
    expect(screen.getByRole('button', { name: /^Restore \(1\)$/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Archive/ })).toBeNull();
  });

  it('scopes the shift-click range to the column order', () => {
    renderColumn([
      makeSession('s-1', 'one'),
      makeSession('s-2', 'two'),
      makeSession('s-3', 'three'),
    ]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'select one' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'select three' }), { shiftKey: true });
    expect(screen.getByText(/3 selected/)).toBeDefined();
  });

  it('selects every card in the column from the All action', () => {
    renderColumn([makeSession('s-1', 'one'), makeSession('s-2', 'two')]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'select one' }));
    fireEvent.click(screen.getByRole('button', { name: /^All$/ }));
    expect(screen.getByText(/2 selected/)).toBeDefined();
  });
});
