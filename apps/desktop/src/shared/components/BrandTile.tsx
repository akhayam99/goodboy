import { DogMascot, cn } from '@goodboy/ui';

type Props = {
  readonly size: number;
  readonly className?: string;
};

const MARK_SCALE = 0.76;
const TILE_RADIUS = 0.28;

export const BrandTile = ({ size, className }: Props) => (
  <span
    data-brand-tile=""
    className={cn('inline-flex shrink-0 items-center justify-center bg-brand', className)}
    style={{ width: size, height: size, borderRadius: size * TILE_RADIUS }}
  >
    <DogMascot size={size * MARK_SCALE} className="text-white" />
  </span>
);
