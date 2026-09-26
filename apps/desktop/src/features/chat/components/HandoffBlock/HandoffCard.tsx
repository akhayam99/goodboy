import type { AgentHandoff, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatCardTime } from '../../utils/format-card-time';
import { handoffSenderLabel } from '../../utils/handoffLabels';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { HANDOFF_SENDER_ICON } from './handoffSenderIcon';
import { HandoffChips } from './HandoffChips';
import { HandoffPanel } from './HandoffPanel';
import { HandoffSections } from './HandoffSections';
import { useHandoffDisclosure } from './useHandoffDisclosure';
import { useHandoffNames } from './useHandoffNames';

type Props = {
  readonly handoff: AgentHandoff;
  readonly sessionId: SessionId | null;
  readonly at: string;
  readonly initiallyOpen: boolean;
};

export const HandoffCard = ({ handoff, sessionId, at, initiallyOpen }: Props) => {
  const disclosure = useHandoffDisclosure({ agentId: handoff.agentId, initiallyOpen });
  const names = useHandoffNames({ sessionId, sender: handoff.sender });
  const Icon = HANDOFF_SENDER_ICON[handoff.sender.kind];
  const activeIndex =
    disclosure.active === 'all' || disclosure.active === null
      ? -1
      : handoff.sections.findIndex((section) => section.kind === disclosure.active);
  const activeSection = activeIndex === -1 ? null : handoff.sections[activeIndex]!;

  return (
    <TranscriptDisclosure
      tone="neutral"
      open={disclosure.open}
      data-testid="handoff-block"
      header={
        <div className="flex min-w-0 flex-col">
          <TranscriptRowHeader
            grouped
            tone="neutral"
            icon={<Icon size={ICON_SIZE.row} aria-hidden />}
            eyebrow="sent by"
            preview={handoffSenderLabel({ sender: handoff.sender, names })}
            meta={formatCardTime(at)}
            open={disclosure.open}
            onToggle={disclosure.toggle}
            aria-label={
              disclosure.open
                ? 'Collapse what the agent received'
                : 'Expand what the agent received'
            }
          />
          <div className="flex min-w-0 flex-col gap-1.5 pb-2 pl-7 pr-2">
            <span className="truncate text-row text-foreground">{handoff.ask}</span>
            {handoff.why === null ? null : (
              <span className="truncate text-label text-muted-foreground">Why: {handoff.why}</span>
            )}
            <HandoffChips
              sections={handoff.sections}
              active={disclosure.active}
              onToggleSection={disclosure.toggleChip}
              onShowAll={disclosure.showAll}
            />
          </div>
        </div>
      }
    >
      {activeSection === null ? null : (
        <HandoffPanel
          section={activeSection}
          index={activeIndex}
          total={handoff.sections.length}
          doneWhen={activeSection.kind === 'ask' ? handoff.doneWhen : null}
          sessionId={sessionId}
          onStep={(delta) => {
            const next =
              handoff.sections[
                (activeIndex + delta + handoff.sections.length) % handoff.sections.length
              ];
            if (next) {
              disclosure.setActive(next.kind);
            }
          }}
          onClose={disclosure.close}
        />
      )}
      {disclosure.active === 'all' ? (
        <HandoffSections handoff={handoff} sections={handoff.sections} sessionId={sessionId} />
      ) : null}
    </TranscriptDisclosure>
  );
};
