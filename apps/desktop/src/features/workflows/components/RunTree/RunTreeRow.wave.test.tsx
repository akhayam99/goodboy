// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent } from '@goodboy/types';
import { layoutTimelineRail } from '../../../workTreeModel/railGeometry';
import type { TimelineRowItem } from '../../../session/timeline/buildTimelineStream';
import { RunTreeRow } from './RunTreeRow';
import type { RunTreeDensity } from './runTreeDensity';
import { baseAgents, child, streamOf } from './testing/runTreeFixtures';

afterEach(cleanup);

const ROUTING = {
  stepById: new Map(),
  roleModels: null,
  sessionProvider: null,
  sessionEffort: null,
};

const AGENTS: ReadonlyArray<Agent> = [...baseAgents, child({ id: 'part', minute: 11 })];

type Params = Readonly<{
  id: string;
  density: RunTreeDensity;
  waveLabel: string | null;
}>;

const renderRow = ({ id, density, waveLabel }: Params): void => {
  const stream = streamOf({ agents: AGENTS });
  const layout = layoutTimelineRail({
    rows: stream.items,
    groups: stream.groups,
    hasSpine: false,
  });
  const item = stream.items.find(
    (candidate): candidate is TimelineRowItem =>
      candidate.kind === 'row' && candidate.id === `agent:${id}`,
  );
  const rail = layout.rows.find((candidate) => candidate.id === `agent:${id}`);
  if (item === undefined || rail === undefined || item.entry.kind !== 'agent') {
    throw new Error(`row ${id} is missing`);
  }
  render(
    <RunTreeRow
      density={density}
      item={item}
      entry={item.entry}
      rail={rail}
      railWidth={layout.width}
      routing={ROUTING}
      costUsd={0}
      isNested={item.entry.agent.parentAgentId != null}
      hasActionColumn={false}
      plan={null}
      waveLabel={waveLabel}
      parentStepName={null}
      isSelected={false}
      isHighlighted={false}
      skip={null}
      onSelect={vi.fn()}
      onAnswer={vi.fn()}
    />,
  );
};

describe('RunTreeRow wave label', () => {
  it('names the wave on a sub-agent row of a page', () => {
    renderRow({ id: 'part', density: 'page', waveLabel: 'Then, in parallel' });

    expect(screen.getByTestId('run-tree-wave').textContent).toBe('Then, in parallel');
  });

  it('adds nothing to a row with no wave label', () => {
    renderRow({ id: 'part', density: 'page', waveLabel: null });

    expect(screen.queryByTestId('run-tree-wave')).toBeNull();
  });

  it('adds nothing to a step row or to a rail', () => {
    renderRow({ id: 'implement', density: 'page', waveLabel: 'Runs first' });
    expect(screen.queryByTestId('run-tree-wave')).toBeNull();
    cleanup();

    renderRow({ id: 'part', density: 'rail', waveLabel: 'Runs first' });
    expect(screen.queryByTestId('run-tree-wave')).toBeNull();
  });
});
