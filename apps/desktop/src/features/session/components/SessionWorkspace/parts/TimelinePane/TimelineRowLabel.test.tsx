// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AGENT_KIND_META, type AgentKind } from '../../../../agent-kind';
import type {
  TimelineRowItem,
  TimelineStreamEntry,
} from '../../../../timeline/buildTimelineStream';
import { TIMELINE_RHYTHM, type TimelineRowGrade } from '../../../../timeline/timelineRhythm';
import { TimelineRowLabel } from './TimelineRowLabel';

afterEach(cleanup);

type AgentParams = {
  readonly agentKind: AgentKind;
  readonly name: string;
  readonly isChained?: boolean;
};

const agentEntry = ({ agentKind, name, isChained = false }: AgentParams): TimelineStreamEntry =>
  ({
    kind: 'agent',
    id: `agent:${agentKind}`,
    at: '2026-08-17T09:04:00Z',
    ordinal: 1,
    agent: { id: agentKind, name, status: 'completed' },
    agentKind,
    stepLabel: null,
    openQuestions: [],
    terminalQuestions: [],
    children: [],
    answers: [],
    hasDuration: true,
    chain: isChained ? { identity: { index: 0, chip: 'text-accent' } } : null,
  }) as unknown as TimelineStreamEntry;

type ItemParams = {
  readonly entry: TimelineStreamEntry;
  readonly grade?: TimelineRowGrade;
};

const itemOf = ({ entry, grade = 'entry' }: ItemParams): TimelineRowItem => ({
  kind: 'row',
  id: entry.id,
  at: '2026-08-17T09:04:00Z',
  grade,
  entry,
  identity: null,
  familyId: null,
  ordinal: null,
  markerState: 'done',
  hasUnread: false,
  height: TIMELINE_RHYTHM.grade[grade].height,
  topY: 0,
  markerY: 18,
  topAnchorY: null,
  groupId: null,
  isPending: false,
  gap: 'entry',
});

const renderKind = ({ agentKind, name, isChained }: AgentParams) =>
  render(<TimelineRowLabel item={itemOf({ entry: agentEntry({ agentKind, name, isChained }) })} />);

describe('TimelineRowLabel', () => {
  it('leads a resolver row with its role chip, like every other kind of agent', () => {
    renderKind({ agentKind: 'resolver', name: 'resolve: 2 review threads' });

    expect(screen.getByText(AGENT_KIND_META.resolver.label)).toBeDefined();
    expect(screen.getByText('resolve: 2 review threads')).toBeDefined();
  });

  it('spells the role out in full rather than abbreviating it', () => {
    renderKind({ agentKind: 'generic', name: 'Look into the failing build' });

    expect(screen.getByText('Generalist')).toBeDefined();
    expect(screen.queryByText('gen')).toBeNull();
  });

  it('holds one fixed chip width down the column, whatever the role is', () => {
    const widths = new Set<string>();
    for (const agentKind of [
      'resolver',
      'generic',
      'planner',
      'pr-reviewer',
    ] satisfies ReadonlyArray<AgentKind>) {
      const { container } = renderKind({ agentKind, name: 'A step' });
      const chip = container.firstElementChild;
      const width = (chip?.className ?? '')
        .split(' ')
        .filter((token) => token.includes('w-'))
        .join(' ');

      expect(width).not.toBe('');
      widths.add(width);
      cleanup();
    }

    expect(widths.size).toBe(1);
  });

  it('keeps a chained agent under its own name and its own role', () => {
    renderKind({ agentKind: 'planner', name: 'Draft the migration', isChained: true });

    expect(screen.getByText(AGENT_KIND_META.planner.label)).toBeDefined();
    expect(screen.getByText('Draft the migration')).toBeDefined();
  });

  it('marks the role chip of a chain root with the chain glyph', () => {
    const { container } = renderKind({
      agentKind: 'planner',
      name: 'Draft the migration',
      isChained: true,
    });

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('marks a chained descendant too, on the step row it lives on', () => {
    const { container } = render(
      <TimelineRowLabel
        item={itemOf({
          entry: agentEntry({
            agentKind: 'implementer',
            name: 'Apply the migration',
            isChained: true,
          }),
          grade: 'step',
        })}
      />,
    );

    expect(screen.getByText(AGENT_KIND_META.implementer.label)).toBeDefined();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('leaves the role chip unmarked when the agent belongs to no chain', () => {
    const { container } = renderKind({ agentKind: 'planner', name: 'Draft the migration' });

    expect(screen.getByText(AGENT_KIND_META.planner.label)).toBeDefined();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('keeps the chip off a step row, where the run already names the role', () => {
    render(
      <TimelineRowLabel
        item={itemOf({
          entry: agentEntry({ agentKind: 'resolver', name: 'resolve: one thread' }),
          grade: 'step',
        })}
      />,
    );

    expect(screen.queryByText(AGENT_KIND_META.resolver.label)).toBeNull();
  });
});
