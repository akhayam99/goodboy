import { ImpactSceneFrame } from './impact/ImpactSceneFrame';

export const U26S_IMPACT_SCENES = {
  'u26s-impact-overview': () => <ImpactSceneFrame mode="overview" />,
  'u26s-impact-spend': () => <ImpactSceneFrame mode="spend" />,
  'u26s-impact-empty': () => <ImpactSceneFrame mode="empty" />,
};
