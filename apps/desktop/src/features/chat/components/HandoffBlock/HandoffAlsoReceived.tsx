import { cn } from '@goodboy/ui';
import type { AgentHandoff, SessionId } from '@goodboy/types';
import { TranscriptChevron } from '../TranscriptChevron';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';
import { HandoffChips } from './HandoffChips';
import { HandoffSections } from './HandoffSections';
import { useHandoffDisclosure } from './useHandoffDisclosure';

type Props = {
  readonly handoff: AgentHandoff;
  readonly sessionId: SessionId | null;
};

export const HandoffAlsoReceived = ({ handoff, sessionId }: Props) => {
  const disclosure = useHandoffDisclosure({ agentId: handoff.agentId, initiallyOpen: false });
  const received = handoff.sections.filter((section) => section.kind !== 'ask');

  return (
    <TranscriptDisclosure
      tone="neutral"
      open={disclosure.open}
      data-testid="handoff-also-received"
      header={
        <div className="flex min-w-0 items-center gap-2 py-1 pl-2 pr-2">
          <button
            type="button"
            aria-expanded={disclosure.open}
            onClick={disclosure.toggle}
            className={cn(
              'flex shrink-0 items-center gap-2 text-2xs font-medium text-muted-foreground',
              TRANSCRIPT_ROW_HOVER,
            )}
          >
            <TranscriptChevron open={disclosure.open} />
            Also received
          </button>
          <HandoffChips sections={received} onOpenSection={disclosure.openSection} />
        </div>
      }
    >
      <HandoffSections
        handoff={handoff}
        sections={received}
        sessionId={sessionId}
        openSections={disclosure.openSections}
        onToggleSection={disclosure.toggleSection}
      />
    </TranscriptDisclosure>
  );
};
