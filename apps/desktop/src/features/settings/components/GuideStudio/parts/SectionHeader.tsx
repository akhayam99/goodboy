import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';

type Props = {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly tone: Tone | 'muted';
};

export const SectionHeader = ({ icon, title, description, tone }: Props) => (
  <div className="flex items-start gap-3">
    <span
      className={cn(
        'flex w-5 shrink-0 justify-center',
        tintClasses(tone === 'muted' ? 'neutral' : tone).icon,
      )}
    >
      {icon}
    </span>
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  </div>
);
