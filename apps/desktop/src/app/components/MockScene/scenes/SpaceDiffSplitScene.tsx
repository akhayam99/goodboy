import { BrandDiffScene } from './brand/DiffScene';
import { useSplitDiffPreference } from './useSplitDiffPreference';

export const SpaceDiffSplitScene = () => {
  const isReady = useSplitDiffPreference();
  return isReady ? <BrandDiffScene /> : null;
};
