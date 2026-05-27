import { cn } from '@goodboy/ui';
import { AGENT_KIND_PALETTE, type AgentKind } from '../agent-kind';
import { AgentAvatar } from '../../../shared/components/AgentAvatar';

interface AgentKindChipProps {
  readonly kind: AgentKind;
  readonly muted?: boolean;
  readonly title?: string;
  readonly className?: string;
}

export function AgentKindChip({ kind, muted, title, className }: AgentKindChipProps) {
  const palette = AGENT_KIND_PALETTE[kind];
  return (
    <span
      className={cn(
        'inline-flex w-[3.75rem] shrink-0 items-center justify-center gap-1 rounded py-0.5 pl-1 pr-1.5 text-[9px] font-semibold uppercase leading-none tracking-wide',
        muted ? 'bg-muted-foreground/20 text-muted-foreground/60' : [palette.bg, 'text-zinc-950'],
        className,
      )}
      title={title}
      aria-hidden
    >
      <AgentAvatar
        kind={kind}
        size="xs"
        className={muted ? 'bg-muted-foreground/60' : 'bg-zinc-950/80'}
      />
      <span>{palette.label}</span>
    </span>
  );
}
