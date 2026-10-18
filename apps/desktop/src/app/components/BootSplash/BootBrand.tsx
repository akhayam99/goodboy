import { BrandTile } from '../../../shared/components/BrandTile';
import { SPLASH_TILE_PX } from '../../../features/onboarding/OnboardingWizard/useSplashAnchor/splashShift';

export const BootBrand = () => (
  <div className="flex flex-col items-center gap-4">
    <BrandTile size={SPLASH_TILE_PX} />
    <span className="text-display text-foreground">Goodboy</span>
  </div>
);
