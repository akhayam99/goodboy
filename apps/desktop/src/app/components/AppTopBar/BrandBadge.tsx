import { DogMascot } from '../../../shared/components/DogMascot';

const TILE_SIZE = 20;
const TILE_RADIUS = 0.28;
const MARK_SCALE = 0.76;

export const BrandBadge = () => (
  <span className="inline-flex shrink-0 items-center gap-2 text-foreground">
    <span
      className="inline-flex shrink-0 items-center justify-center bg-brand"
      style={{ width: TILE_SIZE, height: TILE_SIZE, borderRadius: TILE_SIZE * TILE_RADIUS }}
    >
      <DogMascot size={TILE_SIZE * MARK_SCALE} className="text-white" />
    </span>
    <span className="text-sm font-semibold tracking-tight">Goodboy</span>
  </span>
);
