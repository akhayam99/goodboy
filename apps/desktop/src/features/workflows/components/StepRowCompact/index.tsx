import { cn } from '@goodboy/ui';
import type { AgentKind } from '../../../session/agent-kind';
import { AGENT_KIND_PALETTE } from '../../../session/agent-kind';
import type { VerbosityLevel } from '@goodboy/types';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { shortModel } from '../../../session/agent-row-format';

interface Props {
  readonly index: number;
  readonly kind: AgentKind;
  readonly name: string;
  readonly model: string;
  readonly verbosity: VerbosityLevel;
  readonly className?: string;
}

export function StepRowCompact({ index, kind, name, model, verbosity, className }: Props) {
  const pal = AGENT_KIND_PALETTE[kind];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="w-3 shrink-0 text-right font-mono text-2xs text-muted-foreground/40">
        {index + 1}
      </span>
      <AgentAvatar kind={kind} size="xs" />
      <span className={cn('min-w-0 flex-1 truncate text-2xs font-medium', pal.fg)}>{name}</span>
      <span className="shrink-0 whitespace-nowrap text-right font-mono text-[10px] tabular-nums text-muted-foreground/50">
        {shortModel(model)} · {verbosity}
      </span>
    </div>
  );
}
