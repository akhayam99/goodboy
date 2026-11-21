import { BrandTile } from '../../../../shared/components/BrandTile';

const SIGNATURE_PX = 24;

export const RailSignature = () => (
  <span aria-hidden data-rail-signature="" className="flex shrink-0">
    <BrandTile size={SIGNATURE_PX} />
  </span>
);
