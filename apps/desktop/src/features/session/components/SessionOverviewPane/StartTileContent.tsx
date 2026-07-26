import type { LucideIcon } from 'lucide-react';
import { tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
};

export const StartTileContent = ({ icon: Icon, tone, label }: Props) => (
  <>
    <Icon size={15} aria-hidden className={`shrink-0 ${tintClasses(tone).icon}`} />
    <span className="min-w-0 truncate text-sm font-medium text-foreground">{label}</span>
  </>
);
