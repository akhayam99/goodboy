import { useState } from 'react';
import { Route } from 'lucide-react';
import { Markdown } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'orchestrator_decision' }>;
};

export const OrchestratorDecisionCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <TranscriptDisclosure
      tone="primary"
      open={open}
      bodyClassName="gap-2 text-xs text-foreground/80"
      header={
        <TranscriptRowHeader
          grouped
          tone="primary"
          icon={<Route size={12} aria-hidden />}
          eyebrow="orchestrator"
          preview={item.stepName ?? item.action}
          meta={formatCardTime(item.at)}
          open={open}
          onToggle={() => setOpen((value) => !value)}
        />
      }
    >
      <Markdown text={item.reason} />
    </TranscriptDisclosure>
  );
};
