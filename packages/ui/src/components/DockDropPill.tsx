import { cn } from '../cn';
import { DROP_CHIP_SURFACE } from '../dropChipSurface';
import type { DockAnchor, DockDropZone } from '../dockDropZonesOf';
import { DockDropGlyphSmall } from './DockDropGlyphSmall';

type Props = {
  readonly zone: DockDropZone;
  readonly anchor: DockAnchor;
  readonly isHovered: boolean;
  readonly isDimmed: boolean;
  readonly detail: string | null;
};

const SHIFT = {
  start: '',
  center: '-translate-x-1/2',
  end: '-translate-x-full',
} as const;

const ORIGIN = {
  start: 'origin-left',
  center: 'origin-center',
  end: 'origin-right',
} as const;

export const DockDropPill = ({ zone, anchor, isHovered, isDimmed, detail }: Props) => (
  <div
    data-dock-zone={zone.id}
    aria-hidden="true"
    data-dock-zone-label={zone.label}
    data-dock-zone-hovered={isHovered ? '' : undefined}
    style={{ left: anchor.x, top: anchor.y }}
    className={cn(
      'absolute -translate-y-1/2 motion-safe:transition-[left,top] motion-safe:duration-quick motion-safe:ease-enter',
      SHIFT[anchor.align],
    )}
  >
    <div
      className={cn(
        DROP_CHIP_SURFACE,
        'flex h-8 items-center gap-2 whitespace-nowrap rounded-full pl-2 pr-3 text-eyebrow text-foreground motion-safe:animate-drop-in [&>*]:motion-safe:transition-opacity [&>*]:motion-safe:duration-quick motion-safe:transition-[transform,background-color,color] motion-safe:duration-quick motion-safe:ease-enter',
        ORIGIN[anchor.align],
        isHovered && 'scale-[1.06] bg-primary-solid text-on-primary',
        isDimmed && '[&>*]:opacity-55',
      )}
    >
      <DockDropGlyphSmall placement={zone.placement} />
      <span>{zone.label}</span>
    </div>
    {isHovered && detail !== null ? (
      <span
        className={cn(
          DROP_CHIP_SURFACE,
          'absolute left-1/2 top-[calc(100%+0.5rem)] -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-meta text-foreground',
        )}
      >
        {detail}
      </span>
    ) : null}
  </div>
);
