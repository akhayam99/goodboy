import type { ReactNode } from 'react';
import type { BootPhase } from '../../../store/slices/boot/state';
import {
  SPLASH_TILE_CENTER_ABOVE_MIDDLE_PX,
  SPLASH_TILE_PX,
} from '../../../features/onboarding/OnboardingWizard/useSplashAnchor/splashShift';
import { BootBrand } from './BootBrand';
import { BootProgress } from './BootProgress';
import { BOOT_PHASE_LABEL } from './bootPhaseLabel';

const SPLASH_TILE_TOP_ABOVE_MIDDLE_PX = SPLASH_TILE_CENTER_ABOVE_MIDDLE_PX + SPLASH_TILE_PX / 2;

type Props = {
  readonly phase: BootPhase;
  readonly children?: ReactNode;
};

export const BootStage = ({ phase, children }: Props) => (
  <div
    data-testid="boot-splash-stack"
    className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-6"
    style={{ top: `calc(50% - ${SPLASH_TILE_TOP_ABOVE_MIDDLE_PX}px)` }}
  >
    <BootBrand />
    <div className="flex flex-col items-center gap-3">
      <BootProgress phase={phase} />
      <span className="text-meta text-faint-foreground">{BOOT_PHASE_LABEL[phase]}</span>
      {children}
    </div>
  </div>
);
