import { SHELL_RAIL_TILE, cn } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';

const SIGNATURE_PX = 24;

export const RailSignature = () => (
  <span
    aria-hidden
    data-rail-signature=""
    className={cn('flex shrink-0 items-center justify-center', SHELL_RAIL_TILE)}
  >
    <BrandTile size={SIGNATURE_PX} />
  </span>
);
