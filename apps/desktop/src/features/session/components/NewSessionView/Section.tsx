import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Tone = 'primary' | 'success';

type Props = {
  readonly icon: ReactNode;
  readonly tone: Tone;
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
};

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
};

export const Section = ({ icon, tone, title, subtitle, children }: Props) => (
  <section className="flex flex-col gap-2">
    <header className="flex items-start gap-2">
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          TONE_BG[tone],
        )}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-2xs leading-relaxed text-muted-foreground">{subtitle}</p>
      </div>
    </header>
    {children}
  </section>
);
