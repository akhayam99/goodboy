import type { LucideIcon } from 'lucide-react';
import { ICON_SIZE, cn } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly colorClass: string;
};

export const LiveGlyph = ({ icon: Icon, colorClass }: Props) => (
  <span
    data-live-glyph=""
    aria-hidden
    className={cn(
      'inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-current/12',
      colorClass,
    )}
  >
    <Icon size={ICON_SIZE.mark} aria-hidden />
  </span>
);
