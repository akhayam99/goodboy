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
        'inline-flex w-24 shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-3xs font-semibold uppercase leading-none tracking-wide',
        muted
          ? 'bg-muted text-faint-foreground'
          : [palette.fg, 'bg-current/12 ring-1 ring-inset ring-current/30'],
        className,
      )}
      title={title}
    >
      {palette.label}
    </span>
  );
};
