import { useState } from 'react';
import { Route } from 'lucide-react';
import { cn, ICON_SIZE, Markdown, tintClasses } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { landingLiveKey } from '../../reveal/landingLiveKey';
import { useFreshLanding } from '../../reveal/useFreshLanding';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { TranscriptShell } from '../TranscriptShell';

const infoTint = tintClasses('info');

const LABEL_CLASS = 'text-eyebrow text-muted-foreground';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'orchestrator_decision' }>;
};

export const OrchestratorDecisionCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const note = item.operatorNote?.trim() ?? '';
  const hasNote = note !== '';
  const landing = useFreshLanding({
    liveKey: landingLiveKey({ scope: 'transcript-event', id: item.at }),
    text: item.reason,
  });

  return (
    <div key={landing.fadeKey} {...landing.fade} className="flex min-w-0 flex-col">
      <TranscriptDisclosure
        tone="neutral"
        open={open}
        bodyClassName="gap-2 text-meta text-foreground"
        header={
          <TranscriptRowHeader
            grouped
            tone="neutral"
            icon={<Route size={ICON_SIZE.row} aria-hidden />}
            eyebrow="orchestrator"
            badge={
              hasNote ? (
                <span
                  data-testid="orchestrator-decision-note-badge"
                  className={cn(
                    'shrink-0 rounded-md px-1 py-px text-chip',
                    infoTint.bg,
                    infoTint.text,
                  )}
                >
                  your note
                </span>
              ) : null
            }
            preview={item.stepName ?? item.action}
            meta={formatClock({ at: item.at })}
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
                className="min-w-0 text-meta text-foreground"
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
    </div>
  );
};
