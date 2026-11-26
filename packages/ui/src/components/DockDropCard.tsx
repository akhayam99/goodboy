import { cn } from '../cn';
import type { DockDropZone } from '../dockDropZonesOf';
import { DockDropGlyph } from './DockDropGlyph';

type Props = {
  readonly zone: DockDropZone;
  readonly isHovered: boolean;
  readonly detail: string | null;
};

const BAND_PX = 14;

export const DockDropCard = ({ zone, isHovered, detail }: Props) => {
  const { card, placement } = zone;
  const isBand = (placement === 'above' || placement === 'below') && !isHovered;
  const bandTop = placement === 'above' ? card.y : card.y + card.height - BAND_PX;
  return (
    <div
      data-dock-zone={zone.id}
      data-dock-zone-label={zone.label}
      data-dock-zone-hovered={isHovered ? '' : undefined}
      style={{
        left: card.x,
        top: isBand ? bandTop : card.y,
        width: card.width,
        height: isBand ? BAND_PX : card.height,
      }}
      className={cn(
        'absolute flex flex-col items-center gap-1 overflow-hidden rounded-lg text-meta text-foreground motion-safe:transition-opacity',
        placement === 'merge' ? 'justify-center' : 'justify-start pt-3',
        isHovered
          ? 'border-2 border-solid border-foreground bg-elevated shadow-lg'
          : 'border border-dashed border-border-strong bg-elevated',
      )}
    >
      {isBand ? null : (
        <>
          <DockDropGlyph placement={placement} />
          <span className="whitespace-nowrap text-heading">{zone.label}</span>
          {isHovered && detail !== null ? (
            <span className="truncate text-muted-foreground">{detail}</span>
          ) : null}
        </>
      )}
    </div>
  );
};
