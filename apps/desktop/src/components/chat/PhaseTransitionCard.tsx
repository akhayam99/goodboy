import { useState } from 'react';
import { Collapsible } from '@kay-am/ui';
import type { TranscriptItem } from './transcript-items';

interface PhaseTransitionCardProps {
  readonly item: Extract<TranscriptItem, { kind: 'step_transition' }>;
}

export function PhaseTransitionCard({ item }: PhaseTransitionCardProps) {
  const [open, setOpen] = useState(false);
  const header = `Phase ${item.fromStep.ordinal + 1} ${item.fromStep.name} → Phase ${item.toStep.ordinal + 1} ${item.toStep.name}`;
  const timestamp = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(item.at));

  return (
    <div className="rounded-md border border-border bg-muted px-2 py-1.5">
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        trigger={
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="rounded bg-background px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              phase
            </span>
            {header}
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
