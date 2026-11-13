import { FLOATING_SURFACE, Scrim, Skeleton, cn } from '@goodboy/ui';
import { PALETTE_MIN_HEIGHT_PX } from '../../../features/palette/components/CommandsMode/paletteBodyLayout';

const ROWS = [0, 1, 2, 3, 4];

export const PaletteSkeleton = () => (
  <div
    role="status"
    aria-label="Loading"
    data-testid="palette-skeleton"
    className="fixed inset-0 z-command-palette flex items-start justify-center px-4 pt-14"
  >
    <Scrim />
    <div
      style={{ minHeight: PALETTE_MIN_HEIGHT_PX }}
      className={cn(
        FLOATING_SURFACE,
        'relative flex w-full max-w-[640px] flex-col gap-2 overflow-hidden p-3',
      )}
    >
      <div className="flex h-9 items-center px-2">
        <Skeleton className="h-4 w-1/2" />
      </div>
      {ROWS.map((row) => (
        <div key={row} className="flex min-h-8 items-center gap-3 px-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      ))}
    </div>
  </div>
);
