// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WORK_NODE_SIZE, tintClasses } from '@goodboy/ui';
import { CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import type {
  TimelineRowItem,
  TimelineStreamEntry,
} from '../../../../timeline/buildTimelineStream';
import { DONE_ROW_STATE } from '../../../../../workTreeModel/rowState';
import { TIMELINE_RHYTHM } from '../../../../../workTreeModel/timelineRhythm';
import { TimelineRowMarker } from './TimelineRowMarker';

afterEach(cleanup);

const planEntry = (): TimelineStreamEntry =>
  ({
    kind: 'plan',
    id: 'plan:one',
    at: '2026-08-17T09:04:00Z',
    plan: { id: 'one', title: 'Move the rail geometry', clusterCount: 3 },
  }) as unknown as TimelineStreamEntry;

const branchEntry = (): TimelineStreamEntry =>
  ({
    kind: 'branch',
    id: 'branch:one',
    at: '2026-08-17T09:00:00Z',
    worktree: { branch: 'ak/refactor-markers' },
  }) as unknown as TimelineStreamEntry;

const itemOf = ({ entry }: { readonly entry: TimelineStreamEntry }): TimelineRowItem => ({
  kind: 'row',
  id: entry.id,
  at: '2026-08-17T09:04:00Z',
  grade: 'entry',
  entry,
  identity: null,
  familyId: null,
  ordinal: null,
  nodeIndex: null,
  rowState: DONE_ROW_STATE,
  hasUnread: false,
  height: TIMELINE_RHYTHM.grade.entry.height,
  topY: 0,
  markerY: 18,
  groupId: null,
  isPending: false,
  gap: 'entry',
});

const nodeOf = ({ label }: { readonly label: string }): HTMLElement =>
  screen.getByRole('img', { name: label });

const agentEntry = ({ stepLabel }: { readonly stepLabel: string | null }): TimelineStreamEntry =>
  ({
    kind: 'agent',
    id: 'agent:one',
    at: '2026-08-17T09:04:00Z',
    agent: { id: 'one', name: 'Implement', status: 'pending' },
    stepLabel,
    openQuestions: [],
    children: [],
  }) as unknown as TimelineStreamEntry;

describe('TimelineRowMarker', () => {
  it('draws the plan on the same 20px node as every row, in its concept hue', () => {
    render(<TimelineRowMarker item={itemOf({ entry: planEntry() })} />);
    const plan = nodeOf({ label: 'Plan' });

    expect(plan.style.width).toBe(`${WORK_NODE_SIZE}px`);
    expect(plan.className).toContain(tintClasses(CONCEPT_TONE.plans).ring);
    expect(plan.innerHTML).toContain(tintClasses(CONCEPT_TONE.plans).icon);
    expect(plan.innerHTML).not.toContain('text-warning');
  });

  it('occludes the lane behind the plan marker as well', () => {
    render(<TimelineRowMarker item={itemOf({ entry: planEntry() })} />);

    expect(nodeOf({ label: 'Plan' }).className).toContain('bg-background');
  });

  it('draws a branch as a neutral concept node', () => {
    render(<TimelineRowMarker item={itemOf({ entry: branchEntry() })} />);

    expect(nodeOf({ label: 'Branch' }).getAttribute('data-node-state')).toBe('marker');
  });

  it('prints the local index inside a queued step, not its full path', () => {
    render(
      <TimelineRowMarker
        item={{
          ...itemOf({ entry: agentEntry({ stepLabel: '4.2' }) }),
          nodeIndex: '2',
          rowState: { phase: 'queued', reason: null, ask: null },
        }}
      />,
    );

    const node = nodeOf({ label: 'Not started' });
    expect(node.textContent).toBe('2');
    expect(node.getAttribute('data-node-state')).toBe('queued');
  });

  it('swaps the index for a glyph when the step waits on you', () => {
    render(
      <TimelineRowMarker
        item={{
          ...itemOf({ entry: agentEntry({ stepLabel: '3' }) }),
          nodeIndex: '3',
          rowState: {
            phase: 'waiting',
            reason: { kind: 'question', stepLabel: null },
            ask: { kind: 'answer', question: null },
          },
        }}
      />,
    );

    expect(nodeOf({ label: 'Waiting on your answer' }).textContent).toBe('?');
  });

  it('spins a deciding run in its own identity colour', () => {
    render(
      <TimelineRowMarker
        item={{
          ...itemOf({ entry: agentEntry({ stepLabel: null }) }),
          identity: { spin: 'spin-border-identity-4' } as unknown as TimelineRowItem['identity'],
          rowState: { phase: 'running', reason: { kind: 'deciding' }, ask: null },
        }}
      />,
    );

    expect(nodeOf({ label: 'Choosing the next step' }).className).toContain(
      'spin-border-identity-4',
    );
  });
});
