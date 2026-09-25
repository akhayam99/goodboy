import type { AgentHandoff, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatCardTime } from '../../utils/format-card-time';
import { handoffSenderLabel } from '../../utils/handoffLabels';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { HANDOFF_SENDER_ICON } from './handoffSenderIcon';
import { HandoffChips } from './HandoffChips';
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
  const disclosure = useHandoffDisclosure({ initiallyOpen });
  const names = useHandoffNames({ sessionId, sender: handoff.sender });
  const Icon = HANDOFF_SENDER_ICON[handoff.sender.kind];

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
            <span className="truncate text-sm font-medium text-foreground">{handoff.ask}</span>
            {handoff.why === null ? null : (
              <span className="truncate text-xs text-muted-foreground">Why: {handoff.why}</span>
            )}
            {disclosure.open ? null : (
              <HandoffChips sections={handoff.sections} onOpenSection={disclosure.openSection} />
            )}
          </div>
        </div>
      }
    >
      <HandoffSections
        handoff={handoff}
        sections={handoff.sections}
        sessionId={sessionId}
        openSections={disclosure.openSections}
        onToggleSection={disclosure.toggleSection}
      />
    </TranscriptDisclosure>
  );
};
