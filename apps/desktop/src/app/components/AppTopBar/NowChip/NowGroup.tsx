import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly count: number;
  readonly tone: Tone;
  readonly children: ReactNode;
};

export const NowGroup = ({ label, count, tone, children }: Props) => (
  <section aria-label={label} className="flex flex-col">
    <header
      className={cn(
        'flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-2xs font-semibold uppercase tracking-eyebrow',
        tone === 'neutral' ? 'text-muted-foreground' : tintClasses(tone).text,
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{count}</span>
    </header>
    <ul aria-label={label}>{children}</ul>
  </section>
);
