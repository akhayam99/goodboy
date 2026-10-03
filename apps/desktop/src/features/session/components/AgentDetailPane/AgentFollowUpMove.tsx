import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { RunsOn } from '../../../../shared/components/RunsOn';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { AgentKind, AgentKindRouting } from '../../agent-kind';
import { useKindRouting } from '../../../../shared/hooks/useKindRouting';
import { showsRunsOn } from '../../showsRunsOn';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';

type Props = {
  readonly sessionId: SessionId;
  readonly kind: AgentKind;
  readonly label: string;
  readonly hint: string;
  readonly onSpawn: (routing: AgentKindRouting) => void;
};

export const AgentFollowUpMove = ({ sessionId, kind, label, hint, onSpawn }: Props) => {
  const suggested = useKindRouting({ sessionId, kind });
  const [override, setOverride] = useState<AgentKindRouting | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onSpawn(override ?? suggested)}
        className={cn(
          'group flex items-center gap-2 rounded-md border border-border-soft bg-elevated px-3 py-2 text-left text-label transition-colors hover:border-border',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        )}
      >
        <AgentKindChip kind={kind} title={label} />
        <span className="min-w-0 flex-1 text-foreground">{hint}</span>
        <ArrowRight
          size={ICON_SIZE.row}
          aria-hidden
          className="shrink-0 text-faint-foreground transition-transform group-hover:translate-x-0.5"
        />
      </button>
      {showsRunsOn({ kind }) && (
        <RunsOn suggested={suggested} override={override} onChange={setOverride} className="px-3" />
      )}
    </div>
  );
};
