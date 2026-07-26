import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Chip, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
  readonly description: string;
  readonly chip?: boolean;
};

export const StartRowContent = ({ icon: Icon, tone, label, description, chip }: Props) => (
  <>
    <Icon size={16} aria-hidden className={`shrink-0 ${tintClasses(tone).icon}`} />
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {label}
        {chip ? <Chip tone="accent" size="sm" label="recommended" /> : null}
      </span>
      <span className="truncate text-2xs text-muted-foreground">{description}</span>
    </span>
    <ArrowRight
      size={15}
      aria-hidden
      className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
    />
  </>
);
