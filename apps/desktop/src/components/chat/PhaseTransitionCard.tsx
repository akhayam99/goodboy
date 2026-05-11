import { useState } from 'react';
import { Target } from 'lucide-react';
import { Collapsible } from '@kay-am/ui';
import type { TranscriptItem } from './transcript-items';

interface PhaseTransitionCardProps {
  readonly item: Extract<TranscriptItem, { kind: 'step_transition' }>;
}

export function PhaseTransitionCard({ item }: PhaseTransitionCardProps) {
  const [open, setOpen] = useState(false);
  const header = `Step ${item.fromStep.ordinal + 1} ${item.fromStep.name} → Step ${item.toStep.ordinal + 1} ${item.toStep.name}`;
  const timestamp = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(item.at));

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5">
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        trigger={
          <span className="flex items-center gap-2 text-xs font-medium">
            <Target size={11} aria-hidden className="text-primary" />
            <span className="text-2xs font-medium uppercase tracking-wide text-primary/80">
              step
            </span>
            <span className="text-foreground/85">{header}</span>
          </span>
        }
      >
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-background p-2 text-xs text-muted-foreground">
          {item.carryForwardContext}
        </pre>
        <p className="mt-1 text-right text-2xs text-muted-foreground">{timestamp}</p>
      </Collapsible>
    </div>
  );
}
