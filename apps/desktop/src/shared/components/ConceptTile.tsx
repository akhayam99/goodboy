import type { LucideIcon } from 'lucide-react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
};

const TILE_ICON_SIZE = 24;

export const ConceptTile = ({ icon: Icon, tone }: Props) => {
  const tint = tintClasses(tone);
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-lg',
        tint.bg,
        tint.icon,
      )}
    >
      <Icon size={TILE_ICON_SIZE} />
    </span>
  );
};
