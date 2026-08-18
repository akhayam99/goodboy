import { DogMascot } from '../../../shared/components/DogMascot';

const TILE_SIZE = 20;
const TILE_RADIUS = 0.28;
const MARK_SCALE = 0.76;
const MARK_LEFT = 0.12;
const MARK_TOP = 0.151;

export const BrandBadge = () => (
  <span className="inline-flex shrink-0 items-center gap-2 text-foreground">
    <span
      className="relative inline-block shrink-0 bg-brand"
      style={{ width: TILE_SIZE, height: TILE_SIZE, borderRadius: TILE_SIZE * TILE_RADIUS }}
    >
      <span
        className="absolute text-white"
        style={{ left: TILE_SIZE * MARK_LEFT, top: TILE_SIZE * MARK_TOP }}
      >
        <DogMascot size={TILE_SIZE * MARK_SCALE} />
      </span>
    </span>
    <span className="text-sm font-semibold tracking-tight">Goodboy</span>
  </span>
);
