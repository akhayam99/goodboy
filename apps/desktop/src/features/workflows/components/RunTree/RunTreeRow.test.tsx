// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent } from '@goodboy/types';
import {
  layoutTimelineRail,
  railColumnX,
  railInsetOf,
  type RailLayout,
} from '../../../workTreeModel/railGeometry';
import type { TimelineRowItem } from '../../../session/timeline/buildTimelineStream';
import { RunTreeRow } from './RunTreeRow';
import { baseAgents, child, streamOf } from './testing/runTreeFixtures';

afterEach(cleanup);

const ROUTING = {
  stepById: new Map(),
  roleModels: null,
  sessionProvider: null,
  sessionEffort: null,
};

const NESTED: ReadonlyArray<Agent> = [
  child({ id: 'lead', minute: 11 }),
  child({ id: 'grand', minute: 12, parent: 'lead' }),
];

type Laid = {
  readonly items: ReadonlyArray<TimelineRowItem>;
  readonly layout: RailLayout;
};

const laidOut = ({ agents }: { readonly agents: ReadonlyArray<Agent> }): Laid => {
  const stream = streamOf({ agents });
  return {
    items: stream.items.filter((item): item is TimelineRowItem => item.kind === 'row'),
    layout: layoutTimelineRail({ rows: stream.items, groups: stream.groups, hasSpine: false }),
  };
};

const slotOf = ({ laid, id }: { readonly laid: Laid; readonly id: string }): number => {
  const item = laid.items.find((candidate) => candidate.id === `agent:${id}`);
  const rail = laid.layout.rows.find((candidate) => candidate.id === `agent:${id}`);
  if (item === undefined || rail === undefined || item.entry.kind !== 'agent') {
    throw new Error(`row ${id} is missing`);
  }
  render(
    <RunTreeRow
      item={item}
      entry={item.entry}
      rail={rail}
      railWidth={laid.layout.width}
      routing={ROUTING}
      costUsd={0}
      isNested={item.entry.agent.parentAgentId != null}
      hasActionColumn={false}
      plan={null}
      parentStepName={null}
      isSelected={false}
      isHighlighted={false}
      skip={null}
      onSelect={vi.fn()}
      onAnswer={vi.fn()}
    />,
  );
  const slot = screen.getByTestId('run-tree-rail-slot');
  cleanup();
  return Number.parseFloat(slot.style.width);
};

describe('RunTreeRow indent', () => {
  it('leaves a top row where it was, with or without sub-agents in the run', () => {
    const plain = laidOut({ agents: baseAgents });
    const nested = laidOut({ agents: [...baseAgents, ...NESTED] });

    expect(slotOf({ laid: plain, id: 'implement' })).toBe(plain.layout.width);
    expect(slotOf({ laid: nested, id: 'implement' })).toBe(nested.layout.width);
  });

  it('starts a depth-1 row one rail column right of its parent', () => {
    const laid = laidOut({ agents: [...baseAgents, ...NESTED] });

    expect(slotOf({ laid, id: 'lead' }) - slotOf({ laid, id: 'implement' })).toBe(
      railColumnX({ column: 1 }) - railColumnX({ column: 0 }),
    );
  });

  it('starts a depth-2 row two rail columns right of the step', () => {
    const laid = laidOut({ agents: [...baseAgents, ...NESTED] });

    expect(slotOf({ laid, id: 'grand' }) - slotOf({ laid, id: 'implement' })).toBe(
      railColumnX({ column: 2 }) - railColumnX({ column: 0 }),
    );
  });

  it('puts the content of a nested row at the inset of its own rail', () => {
    const laid = laidOut({ agents: [...baseAgents, ...NESTED] });
    const own = laid.layout.rows.find((row) => row.id === 'agent:grand');
    const top = laid.layout.rows.find((row) => row.id === 'agent:implement');
    if (own === undefined || top === undefined) {
      throw new Error('rails are missing');
    }

    expect(slotOf({ laid, id: 'grand' })).toBe(
      laid.layout.width + railInsetOf({ rail: own }) - railInsetOf({ rail: top }),
    );
  });
});
