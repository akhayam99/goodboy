import { Disclosure } from '@goodboy/ui';
import type { HandoffSection, SessionId } from '@goodboy/types';
import { HANDOFF_SECTION_LABEL } from '../../utils/handoffLabels';
import { HandoffSectionBody } from './HandoffSectionBody';

type Props = {
  readonly section: HandoffSection;
  readonly doneWhen: string | null;
  readonly sessionId: SessionId | null;
  readonly open: boolean;
  readonly onToggle: () => void;
};

export const HandoffSectionRow = ({ section, doneWhen, sessionId, open, onToggle }: Props) => (
  <Disclosure
    testId={`handoff-section-${section.kind}`}
    isOpen={open}
    onToggle={onToggle}
    label={
      <>
        <span className="w-32 shrink-0 text-chip text-muted-foreground">
          {HANDOFF_SECTION_LABEL[section.kind]}
        </span>
        <span className="min-w-0 flex-1 truncate text-meta text-foreground">{section.summary}</span>
      </>
    }
  >
    <div className="flex min-w-0 flex-col py-2">
      <HandoffSectionBody section={section} doneWhen={doneWhen} sessionId={sessionId} />
    </div>
  </Disclosure>
);
