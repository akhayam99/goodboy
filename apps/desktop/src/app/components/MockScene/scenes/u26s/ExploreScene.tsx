import { ExploreScene } from '../audit/ExploreScene';

const DRAWER_PX = 400;

export const U26S_EXPLORE_SCENES = {
  'u26s-explore-rows': () => <ExploreScene />,
  'u26s-explore-empty': () => <ExploreScene variant="empty" />,
  'u26s-explore-drawer': () => <ExploreScene widthPx={DRAWER_PX} />,
  'u26s-explore-nomount': () => <ExploreScene roots="none" />,
};
