import { ExploreScene } from '../audit/ExploreScene';

const OPEN_REPOSITORY: ReadonlyArray<string> = ['apps', 'src', 'settlement'];
const OPEN_SETTLEMENT: ReadonlyArray<string> = ['src', 'settlement'];
const OPEN_NODE_MODULES: ReadonlyArray<string> = ['node_modules'];

const COLUMN_PX = 480;
const COMPACT_PX = 400;

export const U24_EXPLORE_ROWS_SCENES = {
  'explore-rows': () => (
    <ExploreScene openLabels={OPEN_REPOSITORY} hoverRow="rounding.ts" hoverAction="ask" />
  ),
  'explore-rows-keys': () => (
    <ExploreScene openLabels={OPEN_SETTLEMENT} focusRow="rounding.test.ts" />
  ),
  'explore-rows-narrow': () => <ExploreScene openLabels={OPEN_SETTLEMENT} widthPx={COLUMN_PX} />,
  'explore-rows-compact': () => (
    <ExploreScene openLabels={OPEN_SETTLEMENT} widthPx={COMPACT_PX} hoverRow="rounding.ts" />
  ),
  'explore-rows-big': () => <ExploreScene isBig openLabels={OPEN_NODE_MODULES} />,
  'explore-rows-empty': () => <ExploreScene variant="empty" />,
};
