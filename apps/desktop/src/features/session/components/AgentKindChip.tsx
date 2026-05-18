import { cn } from '@kay-am/ui';
import { AGENT_KIND_PALETTE, type AgentKind } from '../agent-kind';

interface AgentKindChipProps {
  readonly kind: AgentKind;
  readonly title?: string;
  readonly className?: string;
}

export function AgentKindChip({ kind, title, className }: AgentKindChipProps) {
  const palette = AGENT_KIND_PALETTE[kind];
  return (
    <span
      className={cn(
        'inline-flex w-[3.25rem] shrink-0 items-center justify-center rounded py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide',
        palette.bg,
        'text-zinc-950',
        className,
      )}
      title={title}
      aria-hidden
    >
      {palette.label}
    </span>
  );
}
