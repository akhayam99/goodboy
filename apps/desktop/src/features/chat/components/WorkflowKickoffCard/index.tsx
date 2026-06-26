import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { Collapsible, Markdown } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'workflow_kickoff' }>;
};

export const WorkflowKickoffCard = ({ item }: Props) => {
  const [goalOpen, setGoalOpen] = useState(false);
  const [markerOpen, setMarkerOpen] = useState(false);
  const timestamp = formatCardTime(item.at);

  if (!item.parsed) {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2">
        <span className="flex items-center gap-2">
          <Rocket size={11} aria-hidden className="text-success" />
          <span className="text-2xs font-medium uppercase tracking-wide text-success/80">
            workflow start
          </span>
        </span>
        <div className="mt-1 overflow-x-auto rounded-md bg-background p-2 text-xs">
          <Markdown text={item.raw} />
        </div>
        <p className="mt-1 text-right text-2xs text-muted-foreground">{timestamp}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-success/30 bg-success/5 px-3 py-2">
      <span className="flex items-center gap-2">
        <Rocket size={11} aria-hidden className="text-success" />
        <span className="text-2xs font-medium uppercase tracking-wide text-success/80">
          workflow start
        </span>
      </span>

      <Collapsible
        open={goalOpen}
        onOpenChange={setGoalOpen}
        trigger={
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            goal
          </span>
        }
      >
        <div className="overflow-x-auto text-xs text-foreground/85">
          <Markdown text={item.goal} />
        </div>
      </Collapsible>

      {item.instructions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="px-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            what to do
          </span>
          <div className="overflow-x-auto rounded-md bg-background p-2 text-xs text-foreground">
            <Markdown text={item.instructions} />
          </div>
        </div>
      ) : null}

      {item.marker.length > 0 ? (
        <Collapsible
          open={markerOpen}
          onOpenChange={setMarkerOpen}
          trigger={
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              marker to emit
            </span>
          }
        >
          <div className="overflow-x-auto rounded-md bg-background p-2 text-xs text-foreground/70">
            <Markdown text={item.marker} />
          </div>
        </Collapsible>
      ) : null}

      <p className="text-right text-2xs text-muted-foreground">{timestamp}</p>
    </div>
  );
};
