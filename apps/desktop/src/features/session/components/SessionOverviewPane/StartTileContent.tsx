import type { LucideIcon } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
};

export const StartTileContent = ({ icon: Icon, tone, label }: Props) => (
  <>
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1',
        tintClasses(tone).bg,
        tintClasses(tone).ring,
      )}
    >
      <Icon size={15} aria-hidden className={tintClasses(tone).icon} />
    </span>
    <span className="min-w-0 truncate text-sm font-medium text-foreground">{label}</span>
  </>
);
