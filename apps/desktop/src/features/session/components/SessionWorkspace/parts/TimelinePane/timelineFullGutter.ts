import { layoutTimelineRail } from '../../../../../workTreeModel/railGeometry';
import type { TimelineStream } from '../../../../timeline/buildTimelineStream';
import { timelineLaneGutterOf } from './timelineLaneGutter';

type Params = {
  readonly openStream: TimelineStream;
};

export const timelineFullGutterOf = ({ openStream }: Params): number => {
  const layout = layoutTimelineRail({ rows: openStream.items, groups: openStream.groups });
  return timelineLaneGutterOf({ items: openStream.items, rails: layout.rows });
};
