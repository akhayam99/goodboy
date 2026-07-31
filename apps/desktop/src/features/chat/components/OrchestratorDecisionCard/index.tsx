import { useState } from 'react';
import { Route } from 'lucide-react';
import { Markdown } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'orchestrator_decision' }>;
};

export const OrchestratorDecisionCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-0.5">
      <TranscriptRowHeader
        tone="primary"
        icon={<Route size={12} aria-hidden />}
        eyebrow="orchestrator"
        preview={item.stepName ?? item.action}
        meta={formatCardTime(item.at)}
        open={open}
        onToggle={() => setOpen((value) => !value)}
      />
      {open && (
        <TranscriptShell
          tone="primary"
          variant="leftBorder"
          nested
          className="flex flex-col gap-2 pl-6 text-xs text-foreground/80"
        >
          <Markdown text={item.reason} />
        </TranscriptShell>
      )}
    </div>
  );
};
