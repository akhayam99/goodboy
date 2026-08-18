import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Tone = 'neutral' | 'success' | 'danger';

const LIFECYCLE_TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
  success: 'border-success/40 text-success hover:bg-success/10',
  danger: 'border-danger/40 text-danger hover:bg-danger/10',
};

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: Tone;
  readonly onClick: () => void;
};

export const ResolverLifecycleButton = ({ icon: Icon, label, tone, onClick }: Props) => (
  <button
    type="button"
    aria-label={label}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-3xs font-medium motion-safe:transition-colors',
      LIFECYCLE_TONE_CLASS[tone],
    )}
  >
    <Icon size={10} aria-hidden />
    {label}
  </button>
);
