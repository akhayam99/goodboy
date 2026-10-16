import { layoutTimelineRail } from '../../../../../workTreeModel/railGeometry';
import type { TimelineStream } from '../../../../timeline/buildTimelineStream';
import { timelineLaneGutterOf } from './timelineLaneGutter';

type OpenGroups = {
  readonly expandedGroupIds: ReadonlySet<string>;
  readonly fullGroupIds: ReadonlySet<string>;
};

type Params = {
  readonly build: (groups: OpenGroups) => TimelineStream;
};

type PassParams = Params & {
  readonly groups: OpenGroups;
  readonly passesLeft: number;
};

type StreamParams = {
  readonly stream: TimelineStream;
};

type CompareParams = {
  readonly before: OpenGroups;
  readonly after: OpenGroups;
};

const MAX_PASSES = 6;

const openGroupsOf = ({ stream }: StreamParams): OpenGroups => ({
  expandedGroupIds: new Set(
    stream.items.flatMap((item) => (item.kind === 'count' ? [item.expandId] : [])),
  ),
  fullGroupIds: new Set(
    stream.items.flatMap((item) => (item.kind === 'more' ? [item.explode.groupId] : [])),
  ),
});

const hasNewGroups = ({ before, after }: CompareParams): boolean =>
  [...after.expandedGroupIds].some((id) => !before.expandedGroupIds.has(id)) ||
  [...after.fullGroupIds].some((id) => !before.fullGroupIds.has(id));

const unionOf = ({ before, after }: CompareParams): OpenGroups => ({
  expandedGroupIds: new Set([...before.expandedGroupIds, ...after.expandedGroupIds]),
  fullGroupIds: new Set([...before.fullGroupIds, ...after.fullGroupIds]),
});

const openStreamOf = ({ build, groups, passesLeft }: PassParams): TimelineStream => {
  const stream = build(groups);
  const found = openGroupsOf({ stream });
  if (passesLeft <= 1 || !hasNewGroups({ before: groups, after: found })) {
    return stream;
  }
  return openStreamOf({
    build,
    groups: unionOf({ before: groups, after: found }),
    passesLeft: passesLeft - 1,
  });
};

export const timelineFullGutterOf = ({ build }: Params): number => {
  const stream = openStreamOf({
    build,
    groups: { expandedGroupIds: new Set(), fullGroupIds: new Set() },
    passesLeft: MAX_PASSES,
  });
  const layout = layoutTimelineRail({ rows: stream.items, groups: stream.groups });
  return timelineLaneGutterOf({ items: stream.items, rails: layout.rows });
};
