import { cn } from '@goodboy/ui';
import type { AgentHandoff, SessionId } from '@goodboy/types';
import { TranscriptChevron } from '../TranscriptChevron';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';
import { HandoffChips } from './HandoffChips';
import { HandoffPanel } from './HandoffPanel';
import { HandoffSections } from './HandoffSections';
import { useHandoffDisclosure } from './useHandoffDisclosure';

type Props = {
  readonly handoff: AgentHandoff;
  readonly sessionId: SessionId | null;
};

export const HandoffAlsoReceived = ({ handoff, sessionId }: Props) => {
  const disclosure = useHandoffDisclosure({ agentId: handoff.agentId, initiallyOpen: false });
  const received = handoff.sections.filter((section) => section.kind !== 'ask');
  const activeIndex =
    disclosure.active === 'all' || disclosure.active === null
      ? -1
      : received.findIndex((section) => section.kind === disclosure.active);
  const activeSection = activeIndex === -1 ? null : received[activeIndex]!;

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
          <HandoffChips
            sections={received}
            active={disclosure.active}
            onToggleSection={disclosure.toggleChip}
            onShowAll={disclosure.showAll}
          />
        </div>
      }
    >
      {activeSection === null ? null : (
        <HandoffPanel
          section={activeSection}
          index={activeIndex}
          total={received.length}
          doneWhen={null}
          sessionId={sessionId}
          onStep={(delta) => {
            const next = received[(activeIndex + delta + received.length) % received.length];
            if (next) {
              disclosure.setActive(next.kind);
            }
          }}
          onClose={disclosure.close}
        />
      )}
      {disclosure.active === 'all' ? (
        <HandoffSections handoff={handoff} sections={received} sessionId={sessionId} />
      ) : null}
    </TranscriptDisclosure>
  );
};
