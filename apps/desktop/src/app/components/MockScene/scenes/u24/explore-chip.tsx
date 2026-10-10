import { ExploreScene } from '../audit/ExploreScene';

const OPEN_SETTLEMENT: ReadonlyArray<string> = ['src', 'settlement'];
const OPEN_PROJECT_MENU: ReadonlyArray<string> = ['Project payments-api'];

export const U24_EXPLORE_CHIP_SCENES = {
  exploremulti: () => <ExploreScene roots="multi" openLabels={OPEN_PROJECT_MENU} />,
  explorefirstlap: () => <ExploreScene roots="first-lap" openLabels={OPEN_SETTLEMENT} />,
  'explore-nomount': () => <ExploreScene roots="none" />,
};
