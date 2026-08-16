import { cn } from '@goodboy/ui';
import { agentKindPalette, type AgentKind } from '../../agent-kind';

type Props = {
  readonly kind: AgentKind;
  readonly muted?: boolean;
  readonly title?: string;
  readonly className?: string;
};

export const AgentKindChip = ({ kind, muted, title, className }: Props) => {
  const palette = agentKindPalette({ kind });
  return (
    <span
      className={cn(
        'inline-flex w-[3.25rem] shrink-0 items-center justify-center rounded py-0.5 text-3xs font-semibold uppercase leading-none tracking-wide',
        muted ? 'bg-muted-foreground/20 text-muted-foreground/60' : [palette.bg, 'text-background'],
        className,
      )}
      title={title}
      aria-hidden
    >
      {palette.label}
    </span>
  );
};
