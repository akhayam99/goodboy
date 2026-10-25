import { BrandTile } from '../../../../shared/components/BrandTile';

const TILE_PX = 44;

export const DemoStageLoading = () => (
  <div
    role="status"
    className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background motion-safe:animate-fade-in"
  >
    <BrandTile
      size={TILE_PX}
      className="ring-1 ring-inset ring-frame-edge motion-safe:animate-soft-pulse"
    />
    <span className="text-meta text-muted-foreground">Opening Goodboy</span>
  </div>
);
