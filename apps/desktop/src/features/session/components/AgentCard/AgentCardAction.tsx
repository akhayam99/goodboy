import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';

type AgentCardActionTone = 'neutral' | 'success' | 'danger';

const HOVER_CLASS: Record<AgentCardActionTone, string> = {
  neutral: 'hover:bg-foreground/10 hover:text-foreground',
  success: 'hover:bg-success/10 hover:text-success',
  danger: 'hover:bg-danger/10 hover:text-danger',
};

const ACTIVE_CLASS: Record<AgentCardActionTone, string> = {
  neutral: 'bg-foreground/10 text-foreground',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
};

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly text?: string;
  readonly tone?: AgentCardActionTone;
  readonly reveal?: boolean;
  readonly active?: boolean;
  readonly pressed?: boolean;
  readonly onClick: () => void;
};

export const AgentCardAction = ({
  icon: Icon,
  label,
  text,
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
      text == null ? 'w-6' : 'px-1.5',
      HOVER_CLASS[tone],
      reveal &&
        'opacity-0 group-hover/agent-card:opacity-100 group-focus-within/agent-card:opacity-100',
      active && ACTIVE_CLASS[tone],
    )}
  >
    <Icon size={12} aria-hidden />
    {text != null && <span>{text}</span>}
  </button>
);
