import { describe, expect, it } from 'vitest';
import type { Agent } from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';
import type {
  TimelineCountItem,
  TimelineStreamItem,
} from '../../../session/timeline/buildTimelineStream';
import { groupSummaryText } from '../../../session/timeline/groupSummary';
import { layoutTimelineRail } from '../../../workTreeModel/railGeometry';
import { markerCenterY, rowBoxHeight } from '../../../workTreeModel/timelineRhythm';
import { foldSettledSets } from './foldSettledSets';
import {
  PARENT_ROW,
  PARENT_SET,
  baseAgents as base,
  child,
  question,
  scouts,
  step,
  streamOf,
} from './testing/runTreeFixtures';

const NO_OPEN: ReadonlySet<string> = new Set();

type FoldParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly questions?: ReadonlyArray<ReturnType<typeof question>>;
  readonly kinds?: Readonly<Record<string, AgentKind>>;
  readonly openIds?: ReadonlySet<string>;
};

const foldedOf = ({ openIds = NO_OPEN, ...params }: FoldParams) => {
  const stream = streamOf(params);
  return foldSettledSets({ items: stream.items, groups: stream.groups, openIds });
};

const idsOf = ({ items }: { readonly items: ReadonlyArray<TimelineStreamItem> }) =>
  items.map((item) => item.id);

const countOf = ({
  items,
}: {
  readonly items: ReadonlyArray<TimelineStreamItem>;
}): TimelineCountItem | undefined =>
  items.find((item): item is TimelineCountItem => item.kind === 'count');

const textOf = ({
  items,
}: {
  readonly items: ReadonlyArray<TimelineStreamItem>;
}): string | null => {
  const fold = countOf({ items });
  return fold === undefined ? null : groupSummaryText({ summary: fold.summary });
};

describe('foldSettledSets', () => {
  it('folds three settled children into one fold item right after a running parent', () => {
    const { items, childIdsBySetId } = foldedOf({ agents: [...base, ...scouts()] });

    expect(idsOf({ items })).toEqual([
      'agent:scout',
      PARENT_ROW,
      `count:${PARENT_SET}`,
      'agent:review',
    ]);
    expect(childIdsBySetId.get(PARENT_SET)).toEqual(['scout-a', 'scout-b', 'scout-c']);
  });

  it('keeps the set expanded while one child is running', () => {
    const { items, liveSetIds } = foldedOf({
      agents: [...base, ...scouts('running')],
    });

    expect(countOf({ items })).toBeUndefined();
    expect(idsOf({ items })).toEqual([
      'agent:scout',
      PARENT_ROW,
      'agent:scout-a',
      'agent:scout-b',
      'agent:scout-c',
      'agent:review',
    ]);
    expect(liveSetIds).toEqual([PARENT_SET]);
  });

  it('keeps the set expanded while one child failed', () => {
    const { items } = foldedOf({ agents: [...base, ...scouts('failed')] });

    expect(countOf({ items })).toBeUndefined();
    expect(idsOf({ items })).toContain('agent:scout-a');
  });

  it('keeps the set expanded while a child has an open question', () => {
    const { items } = foldedOf({
      agents: [...base, ...scouts()],
      questions: [question({ agentId: 'scout-b' })],
    });

    expect(countOf({ items })).toBeUndefined();
    expect(idsOf({ items })).toContain('agent:scout-b');
  });

  it('expands the set again when a fourth child shows up running', () => {
    const settled = foldedOf({ agents: [...base, ...scouts()] });
    const reopened = foldedOf({
      agents: [...base, ...scouts(), child({ id: 'scout-d', minute: 15, status: 'running' })],
    });

    expect(countOf({ items: settled.items })?.isExpanded).toBe(false);
    expect(countOf({ items: reopened.items })).toBeUndefined();
    expect(idsOf({ items: reopened.items })).toEqual([
      'agent:scout',
      PARENT_ROW,
      'agent:scout-a',
      'agent:scout-b',
      'agent:scout-c',
      'agent:scout-d',
      'agent:review',
    ]);
  });

  it('shows an open set under its fold item, oldest first, top to bottom', () => {
    const agents = [
      ...base,
      child({ id: 'late', minute: 13 }),
      child({ id: 'early', minute: 11 }),
      child({ id: 'middle', minute: 12 }),
    ];
    const { items } = foldedOf({ agents, openIds: new Set([PARENT_SET]) });

    expect(idsOf({ items })).toEqual([
      'agent:scout',
      PARENT_ROW,
      `count:${PARENT_SET}`,
      'agent:early',
      'agent:middle',
      'agent:late',
      'agent:review',
    ]);
    expect(countOf({ items })?.isExpanded).toBe(true);
  });

  it('folds whatever the state of the parent is', () => {
    const finished = [
      step({ id: 'scout', ordinal: 1, status: 'completed' }),
      step({ id: 'implement', ordinal: 2, status: 'completed' }),
      step({ id: 'review', ordinal: 3, status: 'completed' }),
    ];
    const { items } = foldedOf({ agents: [...finished, ...scouts()] });

    expect(countOf({ items })?.isExpanded).toBe(false);
    expect(idsOf({ items })).not.toContain('agent:scout-a');
  });

  it('says what the set is: the shared role, done, and nothing for a mixed set', () => {
    const agents = [...base, ...scouts()];
    const kinds = Object.fromEntries(scouts().map((agent) => [agent.id, 'scout' as const]));
    const same = foldedOf({ agents, kinds });
    const mixed = foldedOf({ agents, kinds: { ...kinds, 'scout-c': 'tester' } });

    expect(textOf({ items: same.items })).toBe('3 scouts · done');
    expect(textOf({ items: mixed.items })).toBe('3 subagents · done');
  });

  it('gives the fold item the count grade and sits it on the child lane', () => {
    const stream = streamOf({ agents: [...base, ...scouts()] });
    const { items, groups } = foldSettledSets({
      items: stream.items,
      groups: stream.groups,
      openIds: NO_OPEN,
    });
    const fold = countOf({ items });
    const layout = layoutTimelineRail({ rows: items, groups, hasSpine: false });
    const index = items.findIndex((item) => item.id === fold?.id);

    expect(fold?.height).toBe(rowBoxHeight({ grade: 'count', gap: 'sibling' }));
    expect(fold?.markerY).toBe(markerCenterY({ grade: 'count', gap: 'sibling' }));
    expect(fold?.groupId).toBe(`lane:${PARENT_ROW}`);
    expect(layout.rows[index]?.markerColumn).toBe(1);
    expect(layout.rows[index - 1]?.markerColumn).toBe(0);
  });

  it('folds an inner set on its own and drops its lane when the outer set folds', () => {
    const agents = [
      ...base,
      child({ id: 'lead', minute: 11 }),
      child({ id: 'grand-a', minute: 12, parent: 'lead' }),
      child({ id: 'grand-b', minute: 13, parent: 'lead' }),
    ];
    const outerOpen = foldedOf({ agents, openIds: new Set([PARENT_SET]) });
    const outerFolded = foldedOf({ agents });

    expect(idsOf({ items: outerOpen.items })).toEqual([
      'agent:scout',
      PARENT_ROW,
      `count:${PARENT_SET}`,
      'agent:lead',
      'count:subagents:agent:lead',
      'agent:review',
    ]);
    expect(idsOf({ items: outerFolded.items })).toEqual([
      'agent:scout',
      PARENT_ROW,
      `count:${PARENT_SET}`,
      'agent:review',
    ]);
    expect(outerFolded.groups.some((group) => group.id === 'lane:agent:lead')).toBe(false);
    expect(outerOpen.groups.some((group) => group.id === 'lane:agent:lead')).toBe(true);
  });

  it('leaves a run without sub-agents as it is', () => {
    const stream = streamOf({ agents: base });
    const folded = foldSettledSets({
      items: stream.items,
      groups: stream.groups,
      openIds: NO_OPEN,
    });

    expect(folded.items).toEqual(stream.items);
    expect(folded.groups).toEqual(stream.groups);
    expect(folded.liveSetIds).toEqual([]);
  });
});
