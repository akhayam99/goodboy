import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone as SharedTone } from '@goodboy/ui';

type Tone = Extract<SharedTone, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>;

type Props = {
  readonly icon: ReactNode;
  readonly tone: Tone;
  readonly label: string;
  readonly body: string;
  readonly onClick?: () => void;
};

export const ConceptCard = ({ icon, tone, label, body, onClick }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col items-start gap-2 rounded-lg border border-border-soft bg-background p-4 text-left motion-safe:transition-all motion-safe:hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
  >
    <span
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md',
        tintClasses(tone).bg,
        tintClasses(tone).text,
      )}
    >
      {icon}
    </span>
    <span className="text-sm font-semibold text-foreground">{label}</span>
    <span className="text-xs leading-relaxed text-muted-foreground">{body}</span>
  </button>
);
