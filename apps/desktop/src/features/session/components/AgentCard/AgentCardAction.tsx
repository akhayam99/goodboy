import type { LucideIcon } from 'lucide-react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';

type AgentCardActionTone = Extract<Tone, 'neutral' | 'success' | 'danger'>;

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone?: AgentCardActionTone;
  readonly reveal?: boolean;
  readonly active?: boolean;
  readonly pressed?: boolean;
  readonly onClick: () => void;
};

export const AgentCardAction = ({
  icon: Icon,
  label,
  tone = 'neutral',
  reveal = false,
  active = false,
  pressed,
  onClick,
}: Props) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={pressed}
    onClick={onClick}
    className={cn(
      'inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-md text-[10px] font-medium text-muted-foreground transition-[background-color,color,opacity] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
      'w-6',
      tintClasses(tone).hoverBgSoft,
      tintClasses(tone).hoverText,
      reveal &&
        'opacity-0 group-hover/agent-card:opacity-100 group-focus-within/agent-card:opacity-100',
      active && cn(tintClasses(tone).bgSoft, tintClasses(tone).text),
    )}
  >
    <Icon size={12} aria-hidden />
  </button>
);
