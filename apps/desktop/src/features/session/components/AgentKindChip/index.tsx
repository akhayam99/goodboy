import { cn } from '@goodboy/ui';
import { AGENT_KIND_PALETTE, type AgentKind } from '../../agent-kind';

interface Props {
  readonly kind: AgentKind;
  readonly muted?: boolean;
  readonly title?: string;
  readonly className?: string;
}

export function AgentKindChip({ kind, muted, title, className }: Props) {
  const palette = AGENT_KIND_PALETTE[kind];
  return (
    <span
      className={cn(
        'inline-flex w-[3.25rem] shrink-0 items-center justify-center rounded py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide',
        muted ? 'bg-muted-foreground/20 text-muted-foreground/60' : [palette.bg, 'text-zinc-950'],
        className,
      )}
      title={title}
      aria-hidden
    >
      {palette.label}
    </span>
  );
}
