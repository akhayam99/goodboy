import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

type Props = {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly tone: Tone;
};

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
  info: 'bg-info/10',
  muted: 'bg-muted',
};

export const SectionHeader = ({ icon, title, description, tone }: Props) => (
  <div className="flex items-start gap-3">
    <span
      className={cn(
        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
        TONE_BG[tone],
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
