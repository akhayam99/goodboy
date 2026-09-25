import { cn } from '@goodboy/ui';
import type { HandoffSection, SessionId } from '@goodboy/types';
import { HANDOFF_SECTION_LABEL } from '../../utils/handoffLabels';
import { TranscriptChevron } from '../TranscriptChevron';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';
import { HandoffSectionBody } from './HandoffSectionBody';

type Props = {
  readonly section: HandoffSection;
  readonly doneWhen: string | null;
  readonly sessionId: SessionId | null;
  readonly open: boolean;
  readonly onToggle: () => void;
};

export const HandoffSectionRow = ({ section, doneWhen, sessionId, open, onToggle }: Props) => (
  <div className="flex min-w-0 flex-col" data-testid={`handoff-section-${section.kind}`}>
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left',
        TRANSCRIPT_ROW_HOVER,
        open && 'bg-hover',
      )}
    >
      <TranscriptChevron open={open} />
      <span className="w-32 shrink-0 text-2xs font-medium text-muted-foreground">
        {HANDOFF_SECTION_LABEL[section.kind]}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">{section.summary}</span>
    </button>
    {open ? (
      <div className="flex min-w-0 flex-col py-2 pl-7 pr-2">
        <HandoffSectionBody section={section} doneWhen={doneWhen} sessionId={sessionId} />
      </div>
    ) : null}
  </div>
);
