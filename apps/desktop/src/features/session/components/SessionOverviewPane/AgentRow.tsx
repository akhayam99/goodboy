import { ArrowRight } from 'lucide-react';
import type { SpawnNode } from '../../../orchestration/components/SpawnTree/lib';
import { AgentKindChip } from '../AgentKindChip';
import { StatusGlyph } from './StatusGlyph';

type Props = {
  readonly agent: SpawnNode;
  readonly onClick: () => void;
};

export const AgentRow = ({ agent, onClick }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-border"
  >
    <span className="flex size-3.5 shrink-0 items-center justify-center">
      <StatusGlyph status={agent.status} />
    </span>
    <AgentKindChip kind={agent.kind} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-medium text-foreground">{agent.name}</span>
      {agent.outputSummary ? (
        <span className="truncate text-2xs text-muted-foreground">{agent.outputSummary}</span>
      ) : null}
    </span>
    <ArrowRight
      size={14}
      aria-hidden
      className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
    />
  </button>
);
