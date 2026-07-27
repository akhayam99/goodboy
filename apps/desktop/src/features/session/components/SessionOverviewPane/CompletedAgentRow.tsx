import { ArrowRight } from 'lucide-react';
import type { SpawnNode } from '../../../orchestration/components/SpawnTree/lib';
import { outputPreview } from '../../../../shared/utils/outputPreview';
import { StatusGlyph } from './StatusGlyph';

type Props = {
  readonly agent: SpawnNode;
  readonly onClick: () => void;
};

export const CompletedAgentRow = ({ agent, onClick }: Props) => {
  const preview = outputPreview({ text: agent.outputSummary });

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3.5 py-2 text-left transition-colors hover:border-border"
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <StatusGlyph status={agent.status} />
      </span>
      <span className="min-w-0 shrink truncate text-sm font-medium text-foreground">
        {agent.name}
      </span>
      {preview !== '' ? (
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">{preview}</span>
      ) : (
        <span className="flex-1" />
      )}
      <ArrowRight
        size={14}
        aria-hidden
        className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    </button>
  );
};
