// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';
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
import { EMPTY_COPY, type ColumnKey } from './emptyCopy';

type StageColumnProps = Parameters<typeof StageColumn>[0];
type ColumnSelection = StageColumnProps['selection'];

const nav = {} as BoardNavigation;

const makeSession = (id: string, goal: string): Session =>
  ({ id: id as SessionId, goal }) as unknown as Session;

const noop = () => undefined;

const makeSelection = (over: Partial<ColumnSelection> = {}): ColumnSelection => ({
  isSelected: () => false,
  getSelectedIds: () => [],
  onItemClick: noop,
  onToggle: noop,
  ...over,
});

type RenderParams = {
  readonly sessions?: ReadonlyArray<Session>;
  readonly selection?: ColumnSelection;
  readonly spec?: StageColumnProps['spec'];
  readonly placement?: StageColumnProps['placement'];
  readonly isLoading?: boolean;
};

const renderColumn = ({
  sessions = [],
  selection = makeSelection(),
  spec = { kind: 'stage', stage: 'building' },
  placement,
  isLoading,
}: RenderParams = {}) =>
  render(
    <StageColumn
      spec={spec}
      sessions={sessions}
      nav={nav}
      selection={selection}
      onClearSelection={noop}
      onRestore={noop}
      placement={placement}
      isLoading={isLoading}
    />,
  );

afterEach(cleanup);

describe('StageColumn', () => {
  it('names an empty lane in one line inside it, without a sentence or a count', () => {
    renderColumn({ spec: { kind: 'stage', stage: 'attention' } });
    const lane = screen.getByRole('group', { name: 'needs you' });

    expect(within(lane).getByText('needs you')).toBeDefined();
    expect(within(lane).getByText('Nothing needs you')).toBeDefined();
    expect(within(lane).queryByText(/when an agent asks you something/)).toBeNull();
    expect(within(lane).queryByText('0')).toBeNull();
  });

  it.each<[ColumnKey, string, StageColumnProps['spec']]>([
    ['building', 'building', { kind: 'stage', stage: 'building' }],
    ['running', 'running', { kind: 'stage', stage: 'running' }],
    ['attention', 'needs you', { kind: 'stage', stage: 'attention' }],
    ['review', 'in review', { kind: 'stage', stage: 'review' }],
    ['done', 'done', { kind: 'stage', stage: 'done' }],
    ['archived', 'archived', { kind: 'archived' }],
  ])('keeps the %s lane and its own empty line when it holds no card', (key, label, spec) => {
    renderColumn({ spec });
    const lane = screen.getByRole('group', { name: label });

    expect(within(lane).getByText(EMPTY_COPY[key].title)).toBeDefined();
  });

  it('renders the count and stage label once the lane has cards', () => {
    renderColumn({ sessions: [makeSession('s-1', 'one')] });
    const lane = screen.getByRole('group', { name: 'building' });
    expect(within(lane).getByText('1')).toBeDefined();
    expect(within(lane).getByText('building')).toBeDefined();
    expect(within(lane).queryByText('Nothing in progress')).toBeNull();

    cleanup();
    renderColumn({
      sessions: [makeSession('s-1', 'one')],
      spec: { kind: 'stage', stage: 'running' },
    });
    expect(screen.getByRole('group', { name: 'running' })).toBeDefined();
  });

  it('shows a muted Loading line instead of the empty line while its list is unknown', () => {
    renderColumn({ spec: { kind: 'archived' }, isLoading: true });
    const lane = screen.getByRole('group', { name: 'archived' });

    expect(within(lane).getByText('Loading')).toBeDefined();
    expect(within(lane).queryByText('Nothing archived')).toBeNull();
    expect(lane.getAttribute('aria-busy')).toBe('true');
  });

  it('turns the Loading line into the empty line once the list answers empty', () => {
    renderColumn({ spec: { kind: 'archived' }, isLoading: false });
    const lane = screen.getByRole('group', { name: 'archived' });

    expect(within(lane).queryByText('Loading')).toBeNull();
    expect(within(lane).getByText('Nothing archived')).toBeDefined();
    expect(lane.getAttribute('aria-busy')).toBe('false');
  });

  it('keeps its header, count and empty line when it is half of the stacked lane', () => {
    renderColumn({
      spec: { kind: 'stage', stage: 'done' },
      placement: 'half',
    });
    const half = screen.getByRole('group', { name: 'done' });

    expect(within(half).getByText('Nothing done yet')).toBeDefined();

    cleanup();
    renderColumn({
      sessions: [makeSession('s-1', 'one'), makeSession('s-2', 'two')],
      spec: { kind: 'stage', stage: 'done' },
      placement: 'half',
    });
    const filled = screen.getByRole('group', { name: 'done' });
    expect(within(filled).getByText('2')).toBeDefined();
    expect(within(filled).getAllByRole('button')).toHaveLength(2);
  });

  it('marks the cards the board selection owns', () => {
    renderColumn({
      sessions: [makeSession('s-1', 'one'), makeSession('s-2', 'two')],
      selection: makeSelection({ isSelected: (id) => id === ('s-2' as SessionId) }),
    });

    expect(screen.getByRole('button', { name: 'card one' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'card two' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('routes a modifier click straight to the board selection', () => {
    const onItemClick = vi.fn();
    renderColumn({
      sessions: [makeSession('s-1', 'one')],
      selection: makeSelection({ onItemClick }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'card one' }), { altKey: true });

    expect(onItemClick).toHaveBeenCalledWith('s-1', expect.anything());
  });
});
