// @vitest-environment happy-dom

import { FactCard } from '@goodboy/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
} from '../../../../timeline/buildTimelineGroups';
import { factCardOf } from '../../../../../../__tests__/helpers/factCard';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { DONE_ROW_STATE, type RowState } from '../../../../../workTreeModel/rowState';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import { runIdentity } from '../../../../timeline/runIdentity';
import { TIMELINE_RHYTHM } from '../../../../../workTreeModel/timelineRhythm';
import { ORCHESTRATOR_DECIDING_SENTENCE } from '../../../../../workflows/orchestratorCopy';

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  agentHasUnread: () => false,
  useAppStore: { getState: () => ({ markAgentSeen: vi.fn() }) },
}));

import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import { TimelineModelCell } from './TimelineModelCell';
import { TimelineRowMeta } from './TimelineRowMeta';
import { TimelineFeedState } from './TimelineFeedState';
import { TimelineStreamRow } from './TimelineStreamRow';
import type { CardWrap, TimelineRowIdentity } from './timelineRowIdentity';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'session-1' });

const entryOf = ({ status = 'completed' }: { readonly status?: Agent['status'] } = {}) =>
  ({
    kind: 'agent',
    id: 'agent:one',
    at: '2026-08-17T09:04:00Z',
    ordinal: 2,
    agent: {
      id: typedString<AgentId>({ value: 'one' }),
      sessionId: SESSION_ID,
      ordinal: 2,
      name: 'Implement the parser',
      status,
      startedAt: typedString<IsoDateTime>({ value: '2026-08-17T09:00:00Z' }),
      completedAt: typedString<IsoDateTime>({ value: '2026-08-17T09:04:00Z' }),
    },
    agentKind: 'implementer',
    stepLabel: '2',
    openQuestions: [],
    terminalQuestions: [],
    children: [],
    answers: [],
    hasDuration: true,
  }) as unknown as TimelineAgentEntry;

const itemOf = (): TimelineRowItem => ({
  kind: 'row',
  id: 'agent:one',
  at: '2026-08-17T09:04:00Z',
  grade: 'step',
  entry: entryOf(),
  identity: null,
  familyId: 'run:one',
  ordinal: '2',
  rowState: DONE_ROW_STATE,
  hasUnread: false,
  height: TIMELINE_RHYTHM.grade.step.height + TIMELINE_RHYTHM.gap.sibling,
  topY: 0,
  markerY: 18,
  groupId: 'lane:run:one',
  isPending: false,
  gap: 'sibling',
});

const runEntryOf = (): TimelineRunEntry =>
  ({
    kind: 'run',
    id: 'run:one',
    at: '2026-08-17T09:04:00Z',
    run: { id: 'one', goal: 'Ship the parser', discardedAt: null },
    workflow: { name: 'Orchestrated workflow 3', origin: 'orchestrated' },
    identity: runIdentity({ laneIndex: 0, seed: 0 }),
    children: [],
    producedPlan: null,
  }) as unknown as TimelineRunEntry;

const runItemOf = ({ rowState }: { readonly rowState: RowState }): TimelineRowItem => ({
  ...itemOf(),
  id: 'run:one',
  grade: 'entry',
  entry: runEntryOf(),
  identity: runIdentity({ laneIndex: 0, seed: 0 }),
  ordinal: null,
  rowState,
  groupId: null,
});

const railOf = (): RailRow => ({
  id: 'agent:one',
  height: TIMELINE_RHYTHM.grade.step.height + TIMELINE_RHYTHM.gap.sibling,
  segments: [],
  joins: [],
  markerColumn: 1,
  markerY: 18,
});

type RenderParams = {
  readonly onOpen?: () => void;
};

const renderRow = ({ onOpen = vi.fn() }: RenderParams = {}) =>
  render(
    <TimelineStreamRow
      item={itemOf()}
      rail={railOf()}
      railWidth={32}
      sessionId={SESSION_ID}
      openTarget={{ label: 'Open chat', open: onOpen }}
    />,
  );

afterEach(cleanup);

describe('TimelineStreamRow', () => {
  it('grows by its detail and says it is expanded, keeping the box on top', () => {
    const base = itemOf();
    render(
      <TimelineStreamRow
        item={{ ...base, height: base.height + 48 }}
        rail={{ ...railOf(), height: base.height + 48 }}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={{ label: 'Hide changes', open: vi.fn() }}
        expansion={{ isExpanded: true, controlsId: 'row-detail' }}
        detailHeight={48}
        detail={<div id="row-detail">+ D12 Key on the event id</div>}
      />,
    );

    const row = screen.getByRole('button', { name: /Implement the parser/ });
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.getAttribute('aria-controls')).toBe('row-detail');
    expect(screen.getByText('+ D12 Key on the event id')).toBeDefined();
  });

  it('opens the thing the row is about when the row is clicked', () => {
    const onOpen = vi.fn();
    renderRow({ onOpen });

    fireEvent.click(screen.getByRole('button', { name: /Implement the parser/ }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('announces the row content rather than the verb that opens it', () => {
    renderRow();
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    expect(row.getAttribute('aria-label')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open chat' })).toBeNull();
  });

  it('centres the marker on the rail anchor rather than on the row box, for a row that is not an agent', () => {
    const { container } = render(
      <TimelineStreamRow
        item={runItemOf({ rowState: DONE_ROW_STATE })}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={null}
      />,
    );
    const marker = container.querySelector('[style*="top: 18px"]');

    expect(marker).not.toBeNull();
    expect(marker?.className).toContain('-translate-y-1/2');
  });

  it('draws no gutter node and no curved connector on an agent row, the glyph is its only marker', () => {
    const rail: RailRow = {
      ...railOf(),
      joins: [
        {
          kind: 'branch',
          spineColumn: 0,
          laneColumn: 1,
          laneId: 'lane',
          identityIndex: 0,
          isMuted: false,
          dash: 'solid',
          anchorY: 18,
          path: 'M 0 0 L 8 8',
        },
      ],
    };
    const { container } = render(
      <TimelineStreamRow
        item={itemOf()}
        rail={rail}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={null}
      />,
    );

    expect(container.querySelector('[data-node-state]')).toBeNull();
    expect(container.querySelector('path[stroke]')).toBeNull();
  });

  it('prints the row instant in the gutter and its ordinal beside the label', () => {
    renderRow();

    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('Implement the parser')).toBeDefined();
  });

  it('says when this row started and finished in a card on the clock', () => {
    renderRow();

    expect(factCardOf({ element: screen.getByText(/^\d{2}:\d{2}$/) }).rows).toEqual([
      ['Started', formatClock({ at: '2026-08-17T09:00:00Z' })],
      ['Finished', formatClock({ at: '2026-08-17T09:04:00Z' })],
    ]);
  });

  it('says a running row is still running instead of inventing a finish', () => {
    render(
      <TimelineStreamRow
        item={{ ...itemOf(), rowState: { phase: 'running', reason: null, ask: null } }}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={null}
      />,
    );

    const card = factCardOf({ element: screen.getByText(/^\d{2}:\d{2}$/) });

    expect(card.rows).toEqual([['Started', formatClock({ at: '2026-08-17T09:00:00Z' })]]);
    expect(card.text).toContain('Running');
  });

  it('says the open target and its keys to assistive tech with no hint in the row', () => {
    renderRow();
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    expect(screen.queryByText('Open chat ↵')).toBeNull();
    expect(row.getAttribute('aria-description')).toBe('Open chat, Enter');
  });

  it('renders a plain row when it has no open target', () => {
    render(
      <TimelineStreamRow
        item={itemOf()}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={null}
      />,
    );

    expect(screen.queryByRole('button', { name: /Implement the parser/ })).toBeNull();
    expect(screen.queryByText(/Open chat/)).toBeNull();
    expect(screen.getByText('Implement the parser').parentElement?.className).not.toContain(
      'hover:bg-muted/40',
    );
  });

  it('spins the run marker in its lane hue while the orchestrator is choosing', () => {
    const { container } = render(
      <TimelineStreamRow
        item={runItemOf({
          rowState: { phase: 'running', reason: { kind: 'deciding' }, ask: null },
        })}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={null}
        meta={
          <TimelineRowMeta
            layout="feed"
            state={
              <TimelineFeedState
                state={{ phase: 'running', reason: { kind: 'deciding' }, ask: null }}
              />
            }
          />
        }
      />,
    );
    const marker = container.querySelector('[class*="spin-border"]');

    expect(marker?.className).toContain(runIdentity({ laneIndex: 0, seed: 0 }).spin);
    expect(screen.getByText(ORCHESTRATOR_DECIDING_SENTENCE)).toBeDefined();
    expect(screen.queryByLabelText('Queued')).toBeNull();
  });

  it('leaves a run with no decision in flight on the idle clock and no sentence', () => {
    const { container } = render(
      <TimelineStreamRow
        item={runItemOf({ rowState: { phase: 'queued', reason: null, ask: null } })}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={null}
      />,
    );

    expect(screen.getByLabelText('Queued')).toBeDefined();
    expect(container.querySelector('[class*="spin-border"]')).toBeNull();
    expect(screen.queryByText(ORCHESTRATOR_DECIDING_SENTENCE)).toBeNull();
  });

  it('reserves the same box for a step whatever trailing metadata it carries', () => {
    renderRow();
    const button = screen.getByRole('button', { name: /Implement the parser/ });

    expect(button.getAttribute('style')).toContain(`${TIMELINE_RHYTHM.grade.step.height}px`);
  });

  const renderStateRow = ({ rowState }: { readonly rowState: RowState }) =>
    render(
      <TimelineStreamRow
        item={{ ...itemOf(), rowState }}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={{ label: 'Open agent', open: vi.fn() }}
        meta={<TimelineRowMeta layout="feed" state={<TimelineFeedState state={rowState} />} />}
      />,
    );

  it('draws the row as one feed line at the step height', () => {
    renderStateRow({ rowState: DONE_ROW_STATE });
    const line = within(screen.getByRole('button', { name: /Implement the parser/ })).getByTestId(
      'activity-row',
    );

    expect(line.getAttribute('data-activity-density')).toBe('feed');
    expect(line.getAttribute('data-activity-tone')).toBe('quiet');
  });

  it('puts Answer in the state column of a row that waits on you, behind a warning bar', () => {
    renderStateRow({
      rowState: {
        phase: 'waiting',
        reason: { kind: 'question', stepLabel: null },
        ask: { kind: 'answer', question: null },
      },
    });
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    expect(row.querySelector('[data-meta-column="state"]')?.textContent).toContain('Answer');
    expect(within(row).getByTestId('tone-bar').getAttribute('data-tone')).toBe('warning');
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
  });

  it('marks a failed row with a danger bar and leaves a done row bare', () => {
    renderStateRow({ rowState: { phase: 'failed', reason: { kind: 'failed' }, ask: null } });

    expect(screen.getByTestId('tone-bar').getAttribute('data-tone')).toBe('danger');
    cleanup();

    renderStateRow({ rowState: DONE_ROW_STATE });
    expect(screen.queryByTestId('tone-bar')).toBeNull();
  });

  const laneRailOf = (): RailRow => ({
    ...railOf(),
    segments: [
      {
        column: 1,
        laneId: 'lane:run:one',
        identityIndex: 0,
        isMuted: false,
        dash: 'solid',
        fromY: 0,
        toY: 36,
      },
    ],
  });

  const renderLaneRow = ({ onOpen = vi.fn(), openRun = vi.fn() } = {}) =>
    render(
      <TimelineStreamRow
        item={itemOf()}
        rail={laneRailOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={{ label: 'Open chat', open: onOpen }}
        runLane={{ laneId: 'lane:run:one', title: 'Orchestrated workflow 3', open: openRun }}
      />,
    );

  it('opens the run of the focused row on Shift+Enter', () => {
    const onOpen = vi.fn();
    const openRun = vi.fn();
    renderLaneRow({ onOpen, openRun });
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    expect(row.getAttribute('aria-keyshortcuts')).toBe('Shift+Enter');
    fireEvent.keyDown(row, { code: 'Enter', key: 'Enter', shiftKey: true });
    expect(openRun).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { code: 'Enter', key: 'Enter' });
    expect(openRun).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('TimelineStreamRow, hover cards', () => {
  const IDENTITY: TimelineRowIdentity = {
    hasGlyph: true,
    roleLabel: 'Implementer',
    summary: 'Sonnet 5.5, High',
    wrapCard: ({ children, isOpen }) => (
      <FactCard
        isOpen={isOpen}
        card={{ title: 'Identity card body', facts: [{ label: 'Cost', value: '$0.62' }] }}
      >
        {children}
      </FactCard>
    ),
  };

  const wrapModelsCard: CardWrap = ({ children }) => (
    <FactCard
      card={{ title: 'Models card body', facts: [{ label: 'Sonnet 5.5', value: 'Finished' }] }}
    >
      {children}
    </FactCard>
  );

  let clock = 1_900_000_000_000;

  beforeEach(() => {
    clock += 60_000;
    vi.useFakeTimers();
    vi.setSystemTime(clock);
  });

  const cardText = (): string | null => screen.queryByTestId('fact-card')?.textContent ?? null;

  const enter = ({ element }: { readonly element: HTMLElement }) =>
    fireEvent.pointerEnter(element, { pointerType: 'mouse' });

  const leave = ({ element }: { readonly element: HTMLElement }) =>
    fireEvent.pointerLeave(element, { pointerType: 'mouse' });

  const renderCardRow = ({ withIdentity = true } = {}) =>
    render(
      <TimelineStreamRow
        item={itemOf()}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={{ label: 'Open chat', open: vi.fn() }}
        identity={withIdentity ? IDENTITY : null}
        meta={
          <TimelineRowMeta
            model={
              <TimelineModelCell
                summary={{ name: 'Sonnet 5.5', detail: null, providers: ['anthropic'] }}
                wrapCard={wrapModelsCard}
              />
            }
            time={{
              label: '4m 00s',
              detail: 'Active 4m 00s',
              facts: [],
              footnote: null,
              progress: null,
              headline: '4m 00s',
              note: null,
              isMuchLonger: false,
            }}
            cost="$0.62"
          />
        }
      />,
    );

  const advance = ({ ms }: { readonly ms: number }) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('names the role, the model and the effort in the accessible name of the row', () => {
    renderCardRow();

    expect(screen.getByRole('button', { name: /Implementer.*Sonnet 5\.5, High/ })).toBeDefined();
  });

  it('opens the identity card only after the pointer rests 500ms on the role glyph', () => {
    renderCardRow();
    const glyph = screen.getByTestId('role-glyph');

    enter({ element: glyph });
    advance({ ms: 499 });
    expect(cardText()).toBeNull();

    advance({ ms: 1 });
    expect(cardText()).toContain('Identity card body');
  });

  it('opens nothing when the pointer only passes over the glyph', () => {
    renderCardRow();
    const glyph = screen.getByTestId('role-glyph');

    enter({ element: glyph });
    advance({ ms: 300 });
    leave({ element: glyph });
    advance({ ms: 2_000 });

    expect(cardText()).toBeNull();
  });

  it('closes the card shortly after the pointer leaves', () => {
    renderCardRow();
    const glyph = screen.getByTestId('role-glyph');

    enter({ element: glyph });
    advance({ ms: 500 });
    leave({ element: glyph });
    advance({ ms: 180 });

    expect(cardText()).toBeNull();
  });

  it('opens the next card at once within the warm window and waits again after it', () => {
    renderCardRow();
    const glyph = screen.getByTestId('role-glyph');
    const model = screen.getByText('Sonnet 5.5').closest<HTMLElement>('[data-meta-column="model"]');
    if (model === null) {
      throw new Error('no model cell');
    }

    enter({ element: glyph });
    advance({ ms: 500 });
    leave({ element: glyph });
    advance({ ms: 180 });
    enter({ element: model });
    advance({ ms: 0 });
    expect(cardText()).toContain('Models card body');

    leave({ element: model });
    advance({ ms: 700 });
    enter({ element: glyph });
    advance({ ms: 200 });
    expect(cardText()).toBeNull();

    advance({ ms: 300 });
    expect(cardText()).toContain('Identity card body');
  });

  it('opens the work time card on the duration and nothing on the rest of the row', () => {
    renderCardRow();

    enter({ element: screen.getByText('Implement the parser') });
    advance({ ms: 3_000 });
    expect(cardText()).toBeNull();

    enter({ element: screen.getByText('4m 00s') });
    advance({ ms: 600 });
    expect(cardText()).toContain('Work time');
    expect(cardText()).not.toContain('Identity card body');
  });

  it('describes the glyph with the card sentence for a screen reader', () => {
    renderCardRow();
    const describedBy = screen.getByTestId('role-glyph').getAttribute('aria-describedby') ?? '';

    expect(document.getElementById(describedBy)?.textContent).toBe(
      'Identity card body. Cost, $0.62.',
    );
  });

  it('opens the identity card from the keyboard with i on the focused row', () => {
    renderCardRow();
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    fireEvent.keyDown(row, { key: 'i' });
    expect(cardText()).toContain('Identity card body');

    fireEvent.keyDown(row, { key: 'i' });
    expect(cardText()).toBeNull();
  });

  it('opens the identity card when the row takes keyboard focus, after the same 500ms', () => {
    renderCardRow();
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    fireEvent.keyDown(row, { key: 'Tab' });
    fireEvent.focus(row);
    advance({ ms: 499 });
    expect(cardText()).toBeNull();

    advance({ ms: 1 });
    expect(cardText()).toContain('Identity card body');
  });

  it('does not open the card when a click gives the row focus', () => {
    renderCardRow();
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    fireEvent.pointerDown(row);
    fireEvent.focus(row);
    advance({ ms: 2_000 });

    expect(cardText()).toBeNull();
  });

  it('closes the keyboard card on Escape and when the row loses focus', () => {
    renderCardRow();
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    fireEvent.keyDown(row, { key: 'i' });
    fireEvent.keyDown(row, { key: 'Escape' });
    expect(cardText()).toBeNull();

    fireEvent.keyDown(row, { key: 'i' });
    fireEvent.blur(row);
    expect(cardText()).toBeNull();
  });

  it('leaves i alone on a row that has no identity card', () => {
    renderCardRow({ withIdentity: false });
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    fireEvent.keyDown(row, { key: 'i' });

    expect(cardText()).toBeNull();
  });

  it('leaves i alone when a modifier is held', () => {
    renderCardRow();
    const row = screen.getByRole('button', { name: /Implement the parser/ });

    fireEvent.keyDown(row, { key: 'i', metaKey: true });

    expect(cardText()).toBeNull();
  });
});
