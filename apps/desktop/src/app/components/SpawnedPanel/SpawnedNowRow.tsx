import { TimelineRail } from '../../../features/session/components/SessionWorkspace/parts/TimelinePane/TimelineRail';
import { RAIL_SPINE_X, layoutTimelineRail } from '../../../features/workTreeModel/railGeometry';
import { TIMELINE_RHYTHM } from '../../../features/workTreeModel/timelineRhythm';

const { height: NOW_HEIGHT, ruleY: NOW_RULE_Y } = TIMELINE_RHYTHM.now;

const NOW_RAIL = layoutTimelineRail({
  rows: [
    {
      id: 'now',
      height: NOW_HEIGHT,
      topY: NOW_RULE_Y,
      markerY: null,
      groupId: null,
      isPending: false,
    },
  ],
  groups: [],
});

export const SpawnedNowRow = () => {
  const rail = NOW_RAIL.rows[0];
  if (rail === undefined) {
    return null;
  }
  return (
    <div aria-hidden data-spawned-now="" className="flex min-w-0" style={{ height: NOW_HEIGHT }}>
      <span className="relative shrink-0" style={{ width: NOW_RAIL.width }}>
        <TimelineRail rail={rail} width={NOW_RAIL.width} />
        <span
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border"
          style={{ left: RAIL_SPINE_X, top: NOW_RULE_Y }}
        />
      </span>
      <span className="relative min-w-0 flex-1">
        <span
          className="absolute left-2 -translate-y-1/2 text-eyebrow text-muted-foreground"
          style={{ top: NOW_RULE_Y }}
        >
          Now
        </span>
      </span>
    </div>
  );
};
