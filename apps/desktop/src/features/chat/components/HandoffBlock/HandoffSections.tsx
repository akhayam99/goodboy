import { useState } from 'react';
import type { AgentHandoff, HandoffSection, HandoffSectionKind, SessionId } from '@goodboy/types';
import { HandoffAsSent } from './HandoffAsSent';
import { HandoffSectionRow } from './HandoffSectionRow';

type Props = {
  readonly handoff: AgentHandoff;
  readonly sections: ReadonlyArray<HandoffSection>;
  readonly sessionId: SessionId | null;
};

export const HandoffSections = ({ handoff, sections, sessionId }: Props) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<HandoffSectionKind>>(() => new Set());

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col">
        {sections.map((section) => (
          <HandoffSectionRow
            key={section.kind}
            section={section}
            doneWhen={section.kind === 'ask' ? handoff.doneWhen : null}
            sessionId={sessionId}
            open={!collapsed.has(section.kind)}
            onToggle={() =>
              setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(section.kind)) {
                  next.delete(section.kind);
                  return next;
                }
                next.add(section.kind);
                return next;
              })
            }
          />
        ))}
      </div>
      <HandoffAsSent handoff={handoff} />
    </div>
  );
};
