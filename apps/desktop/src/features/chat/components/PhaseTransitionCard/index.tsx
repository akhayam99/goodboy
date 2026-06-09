import { useState } from 'react';
import { Target } from 'lucide-react';
import { Collapsible, Markdown } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'step_transition' }>;
};

export const PhaseTransitionCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const header = `Step ${item.fromStep.ordinal + 1} ${item.fromStep.name} → Step ${item.toStep.ordinal + 1} ${item.toStep.name}`;
  const timestamp = formatCardTime(item.at);

  return (
    <div className="rounded-md border border-success/30 bg-success/5 px-2 py-1.5">
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        trigger={
          <span className="flex items-center gap-2 text-xs font-medium">
            <Target size={11} aria-hidden className="text-success" />
            <span className="text-2xs font-medium uppercase tracking-wide text-success/80">
              step
            </span>
            <span className="text-foreground/85">{header}</span>
          </span>
        }
      >
        <div className="mt-1 overflow-x-auto rounded-md bg-background p-2 text-xs">
          <Markdown text={item.carryForwardContext} />
        </div>
        <p className="mt-1 text-right text-2xs text-muted-foreground">{timestamp}</p>
      </Collapsible>
    </div>
  );
};
