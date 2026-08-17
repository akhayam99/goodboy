import { useState } from 'react';
import { Route } from 'lucide-react';
import { Markdown, cn, tintClasses } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { TranscriptShell } from '../TranscriptShell';

const infoTint = tintClasses('info');

const LABEL_CLASS = 'text-2xs font-medium uppercase tracking-wide text-muted-foreground';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'orchestrator_decision' }>;
};

export const OrchestratorDecisionCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const note = item.operatorNote?.trim() ?? '';
  const hasNote = note !== '';

  return (
    <TranscriptDisclosure
      tone="neutral"
      open={open}
      bodyClassName="gap-2 text-xs text-foreground/80"
      header={
        <TranscriptRowHeader
          grouped
          tone="neutral"
          icon={<Route size={12} aria-hidden />}
          eyebrow="orchestrator"
          badge={
            hasNote ? (
              <span
                data-testid="orchestrator-decision-note-badge"
                className={cn(
                  'shrink-0 rounded-md px-1 py-px text-2xs font-medium',
                  infoTint.bg,
                  infoTint.text,
                )}
              >
                your note
              </span>
            ) : null
          }
          preview={item.stepName ?? item.action}
          meta={formatCardTime(item.at)}
          open={open}
          onToggle={() => setOpen((value) => !value)}
        />
      }
    >
      {hasNote ? (
        <>
          <div className="flex min-w-0 flex-col gap-1" data-testid="orchestrator-decision-note">
            <span className={LABEL_CLASS}>your note</span>
            <TranscriptShell
              tone="info"
              variant="boxed"
              className="min-w-0 text-xs text-foreground"
            >
              <Markdown text={note} />
            </TranscriptShell>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={LABEL_CLASS}>what the orchestrator decided</span>
            <Markdown text={item.reason} />
          </div>
        </>
      ) : (
        <Markdown text={item.reason} />
      )}
    </TranscriptDisclosure>
  );
};
