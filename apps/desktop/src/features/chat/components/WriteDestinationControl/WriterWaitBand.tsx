import { Button, ICON_SIZE, tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useWriterWait } from './useWriterWait';
import { writerWaitCopy } from './writerWaitCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

const waitTint = tintClasses(CONCEPT_TONE.writerWait);

export const WriterWaitBand = ({ sessionId, agentId }: Props) => {
  const view = useWriterWait({ sessionId, agentId });
  const answerWithoutEditing = useAppStore((state) => state.answerWithoutEditing);
  const cancelWriterWait = useAppStore((state) => state.cancelWriterWait);
  if (view === null || agentId === null) {
    return null;
  }
  const copy = writerWaitCopy({ view });
  const Icon = CONCEPT_ICONS.writerWait;
  return (
    <div className="px-2 pt-2">
      <div
        role="status"
        className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-meta text-muted-foreground"
      >
        <span className="flex h-4 shrink-0 items-center">
          <Icon size={ICON_SIZE.row} aria-hidden className={waitTint.icon} />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <p>
            <strong className="text-foreground">{copy.title}</strong> {copy.body}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" variant="secondary" onClick={() => answerWithoutEditing({ agentId })}>
              Answer without editing
            </Button>
            <Button size="xs" variant="ghost" onClick={() => cancelWriterWait({ agentId })}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
