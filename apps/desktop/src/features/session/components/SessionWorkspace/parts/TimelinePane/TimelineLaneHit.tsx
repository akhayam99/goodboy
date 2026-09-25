import { Tooltip } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../../../shared/keyboard/registry';
import { railColumnX, type RailLaneSpan } from '../../../../../workTreeModel/railGeometry';
import { LANE_HIT_WIDTH } from './timelineLayout';
import type { TimelineLaneTarget } from './TimelineRail';

type Props = {
  readonly span: RailLaneSpan;
  readonly target: TimelineLaneTarget;
  readonly onHover: (params: { readonly laneId: string | null }) => void;
};

export const TimelineLaneHit = ({ span, target, onHover }: Props) => {
  const label = `Open workflow: ${target.title}`;
  return (
    <Tooltip content={`${label} (${shortcutGlyphs('activity.openRun')})`} side="right">
      <button
        type="button"
        tabIndex={-1}
        aria-label={label}
        data-testid="timeline-lane-hit"
        className="absolute cursor-pointer focus-visible:outline-none"
        style={{
          left: railColumnX({ column: span.column }) - LANE_HIT_WIDTH / 2,
          top: span.fromY,
          width: LANE_HIT_WIDTH,
          height: span.toY - span.fromY,
        }}
        onClick={target.open}
        onMouseEnter={() => onHover({ laneId: span.laneId })}
        onMouseLeave={() => onHover({ laneId: null })}
      />
    </Tooltip>
  );
};
