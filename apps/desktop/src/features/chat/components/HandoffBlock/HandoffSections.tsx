import type { AgentHandoff, HandoffSection, HandoffSectionKind, SessionId } from '@goodboy/types';
import { HandoffAsSent } from './HandoffAsSent';
import { HandoffSectionRow } from './HandoffSectionRow';

type Props = {
  readonly handoff: AgentHandoff;
  readonly sections: ReadonlyArray<HandoffSection>;
  readonly sessionId: SessionId | null;
  readonly openSections: ReadonlySet<HandoffSectionKind>;
  readonly onToggleSection: (kind: HandoffSectionKind) => void;
};

export const HandoffSections = ({
  handoff,
  sections,
  sessionId,
  openSections,
  onToggleSection,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 flex-col">
      {sections.map((section) => (
        <HandoffSectionRow
          key={section.kind}
          section={section}
          doneWhen={section.kind === 'ask' ? handoff.doneWhen : null}
          sessionId={sessionId}
          open={openSections.has(section.kind)}
          onToggle={() => onToggleSection(section.kind)}
        />
      ))}
    </div>
    <HandoffAsSent handoff={handoff} />
  </div>
);
