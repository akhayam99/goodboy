import { describe, expect, it } from 'vitest';
import type { RailGroupInput } from '../../workTreeModel/railGeometry';
import type { TimelineStreamItem } from './buildTimelineStream';
import { timelineLaneRuns } from './timelineLaneRuns';

type ItemParams = {
  readonly id: string;
  readonly kind: 'run' | 'agent';
  readonly groupId?: string | null;
};

const itemOf = ({ id, kind, groupId = null }: ItemParams): TimelineStreamItem =>
  JSON.parse(JSON.stringify({ kind: 'row', id, groupId, entry: { kind, id } }));

const groupOf = ({
  id,
  originRowId,
  parentGroupId = null,
}: {
  readonly id: string;
  readonly originRowId: string;
  readonly parentGroupId?: string | null;
}): RailGroupInput => ({
  id,
  originRowId,
  parentGroupId,
  identityIndex: 0,
  isMuted: false,
  shape: 'open',
});

describe('timelineLaneRuns', () => {
  it('maps a run lane, its child lanes and its origin row to the run', () => {
    const lanes = timelineLaneRuns({
      items: [
        itemOf({ id: 'child', kind: 'agent', groupId: 'lane:step' }),
        itemOf({ id: 'step', kind: 'agent', groupId: 'lane:run' }),
        itemOf({ id: 'run', kind: 'run' }),
      ],
      groups: [
        groupOf({ id: 'lane:run', originRowId: 'run' }),
        groupOf({ id: 'lane:step', originRowId: 'step', parentGroupId: 'lane:run' }),
      ],
    });

    expect(lanes.runByLaneId.get('lane:run')?.id).toBe('run');
    expect(lanes.runByLaneId.has('lane:step')).toBe(false);
    expect(lanes.laneIdByRowId.get('child')).toBe('lane:run');
    expect(lanes.laneIdByRowId.get('step')).toBe('lane:run');
    expect(lanes.laneIdByRowId.get('run')).toBe('lane:run');
  });

  it('leaves a standalone agent brood without a run lane', () => {
    const lanes = timelineLaneRuns({
      items: [
        itemOf({ id: 'child', kind: 'agent', groupId: 'lane:agent' }),
        itemOf({ id: 'agent', kind: 'agent' }),
      ],
      groups: [groupOf({ id: 'lane:agent', originRowId: 'agent' })],
    });

    expect(lanes.runByLaneId.size).toBe(0);
    expect(lanes.laneIdByRowId.size).toBe(0);
  });
});
