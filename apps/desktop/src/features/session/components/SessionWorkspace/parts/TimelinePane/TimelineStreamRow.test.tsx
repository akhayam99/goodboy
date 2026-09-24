// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
} from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { DONE_ROW_STATE, type RowState } from '../../../../../workTreeModel/rowState';
import type { TimelineLaneControl } from './TimelineRail';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import { runIdentity } from '../../../../timeline/runIdentity';
import { TIMELINE_RHYTHM } from '../../../../../workTreeModel/timelineRhythm';
import { ORCHESTRATOR_DECIDING_SENTENCE } from '../../../../../workflows/orchestratorCopy';

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  agentHasUnread: () => false,
  useAppStore: { getState: () => ({ markAgentSeen: vi.fn() }) },
}));

import { TimelineStreamRow } from './TimelineStreamRow';

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
  nodeIndex: '2',
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
  nodeIndex: null,
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
  readonly action?: { readonly label: string; readonly onAct: () => void } | null;
};

const renderRow = ({ onOpen = vi.fn(), action = null }: RenderParams = {}) =>
  render(
    <TimelineStreamRow
      item={itemOf()}
      rail={railOf()}
      railWidth={32}
      sessionId={SESSION_ID}
      openTarget={{ label: 'Open chat', open: onOpen }}
      action={action}
    />,
  );

afterEach(cleanup);

describe('TimelineStreamRow', () => {
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

  it('keeps a continuation action as its own target beside the row', () => {
    const onOpen = vi.fn();
    const onAct = vi.fn();
    renderRow({ onOpen, action: { label: 'Answer', onAct } });

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(onAct).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('centres the marker on the rail anchor rather than on the row box', () => {
    const { container } = renderRow();
    const marker = container.querySelector('[style*="top: 18px"]');

    expect(marker).not.toBeNull();
    expect(marker?.className).toContain('-translate-y-1/2');
  });

  it('prints the row instant in the gutter and its ordinal beside the label', () => {
    renderRow();

    expect(screen.getByText(/\d{2}:\d{2}/)).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('Implement the parser')).toBeDefined();
  });

  it('hides the open hint until the row is hovered or focused', () => {
    renderRow();

    expect(screen.getByText('Open chat ↵').className).toContain('opacity-0');
    expect(screen.getByText('Open chat ↵').className).toContain('group-hover:opacity-100');
  });

  it('renders a plain row when it has no open target', () => {
    render(
      <TimelineStreamRow
        item={itemOf()}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={null}
        action={null}
      />,
    );

    expect(screen.queryByRole('button', { name: /Implement the parser/ })).toBeNull();
    expect(screen.queryByText(/Open chat/)).toBeNull();
    expect(screen.getByText('Implement the parser').parentElement?.className).not.toContain(
      'hover:bg-muted/40',
    );
  });

  it('boxes the trailing action to the same height as the row content line', () => {
    renderRow({ action: { label: 'Answer', onAct: vi.fn() } });
    const wrapper = screen.getByTestId('timeline-row-action');
    const content = screen.getByRole('button', { name: /Implement the parser/ });

    expect(wrapper.getAttribute('style')).toBe(content.getAttribute('style'));
    expect(wrapper.className).toContain('items-center');
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
        action={null}
      />,
    );
    const marker = container.querySelector('[class*="spin-border"]');

    expect(marker?.className).toContain(runIdentity({ laneIndex: 0, seed: 0 }).spin);
    expect(screen.getByText(ORCHESTRATOR_DECIDING_SENTENCE)).toBeDefined();
    expect(screen.queryByLabelText('Not started')).toBeNull();
  });

  it('leaves a run with no decision in flight on the idle clock and no sentence', () => {
    const { container } = render(
      <TimelineStreamRow
        item={runItemOf({ rowState: { phase: 'queued', reason: null, ask: null } })}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={null}
        action={null}
      />,
    );

    expect(screen.getByLabelText('Not started')).toBeDefined();
    expect(container.querySelector('[class*="spin-border"]')).toBeNull();
    expect(screen.queryByText(ORCHESTRATOR_DECIDING_SENTENCE)).toBeNull();
  });

  it('reserves the same box for a step whatever trailing metadata it carries', () => {
    renderRow();
    const button = screen.getByRole('button', { name: /Implement the parser/ });

    expect(button.getAttribute('style')).toContain(`${TIMELINE_RHYTHM.grade.step.height}px`);
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

  const lanesOf = ({
    hoveredLaneId = null,
    openRun,
  }: {
    readonly hoveredLaneId?: string | null;
    readonly openRun: () => void;
  }): TimelineLaneControl => ({
    targetFor: ({ laneId }) => ({ laneId, title: 'Orchestrated workflow 3', open: openRun }),
    hoveredLaneId,
    onHover: vi.fn(),
  });

  const renderLaneRow = ({ onOpen = vi.fn(), openRun = vi.fn() } = {}) =>
    render(
      <TimelineStreamRow
        item={itemOf()}
        rail={laneRailOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={{ label: 'Open chat', open: onOpen }}
        action={null}
        lanes={lanesOf({ openRun })}
        runLane={{ laneId: 'lane:run:one', title: 'Orchestrated workflow 3', open: openRun }}
      />,
    );

  it('opens the run from its lane and the leaf from the row text', () => {
    const onOpen = vi.fn();
    const openRun = vi.fn();
    renderLaneRow({ onOpen, openRun });

    fireEvent.click(screen.getByRole('button', { name: 'Open workflow: Orchestrated workflow 3' }));
    expect(openRun).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Implement the parser/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(openRun).toHaveBeenCalledTimes(1);
  });

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

  it('lets the node on a lane pass the pointer through to the lane', () => {
    const { container } = renderLaneRow();
    const marker = container.querySelector('[style*="top: 18px"]');

    expect(marker?.className).toContain('pointer-events-none');
  });

  it('lights the run chip while its lane is hovered', () => {
    const openRun = vi.fn();
    const identity = runIdentity({ laneIndex: 0, seed: 0 });
    const runLane = { laneId: 'lane:run:one', title: 'Orchestrated workflow 3', open: openRun };
    const { rerender } = render(
      <TimelineStreamRow
        item={runItemOf({ rowState: DONE_ROW_STATE })}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={{ label: 'Open run', open: openRun }}
        action={null}
        lanes={lanesOf({ openRun })}
        runLane={runLane}
      />,
    );
    const chip = () => screen.getByText('Workflow');

    expect(chip().className).toContain(identity.chip);

    rerender(
      <TimelineStreamRow
        item={runItemOf({ rowState: DONE_ROW_STATE })}
        rail={railOf()}
        railWidth={32}
        sessionId={SESSION_ID}
        openTarget={{ label: 'Open run', open: openRun }}
        action={null}
        lanes={lanesOf({ openRun, hoveredLaneId: 'lane:run:one' })}
        runLane={runLane}
      />,
    );

    expect(chip().className).toContain(identity.litChip);
  });
});
