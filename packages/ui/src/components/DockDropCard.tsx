import { cn } from '../cn';
import type { DockDropZone } from '../dockDropZonesOf';
import { DockDropGlyph } from './DockDropGlyph';

type Props = {
  readonly zone: DockDropZone;
  readonly isHovered: boolean;
  readonly detail: string | null;
};

const BAND_PX = 6;

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
        'absolute flex flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border-2 text-meta text-foreground motion-safe:transition-opacity',
        isHovered
          ? 'border-solid border-foreground bg-elevated shadow-lg'
          : 'border-dashed border-border-strong bg-elevated',
      )}
    >
      {isBand ? null : (
        <>
          <DockDropGlyph placement={placement} />
          <span className="text-heading">{zone.label}</span>
          {isHovered && detail !== null ? <span className="truncate">{detail}</span> : null}
        </>
      )}
    </div>
  );
};
