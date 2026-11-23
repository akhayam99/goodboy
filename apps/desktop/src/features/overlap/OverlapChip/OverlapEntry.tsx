import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { NAMES } from '../../../shared/utils/names';
import { actionIntentOf } from '../../actions/actionIntentOf';
import { implementerNotesOf } from '../implementerNotesOf';
import { implementerOf } from '../implementerOf';
import { messageBothImplementers, type QueuedNote } from '../messageBothImplementers';
import type { Overlap } from '../overlapsOf';
import { overlapWordsOf } from '../overlapWordsOf';

type Props = {
  readonly overlap: Overlap;
  readonly sessionLabels: ReadonlyMap<SessionId, string>;
  readonly onSent: () => void;
};

const MESSAGE_BOTH = NAMES.messageBothImplementers;
const NO_AGENTS: ReadonlyArray<never> = [];

export const OverlapEntry = ({ overlap, sessionLabels, onSent }: Props) => {
  const [isSending, setIsSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<ReadonlyArray<QueuedNote> | null>(null);
  const mountAgents = useAppStore(
    (state) => state.sessionPhaseRuns[overlap.mount.sessionId] ?? NO_AGENTS,
  );
  const otherAgents = useAppStore(
    (state) => state.sessionPhaseRuns[overlap.other.sessionId] ?? NO_AGENTS,
  );
  const words = overlapWordsOf({ overlap, sessionLabels });
  const notes = implementerNotesOf({
    overlap,
    mountAgent: implementerOf({ agents: mountAgents, mountId: overlap.mount.mountId }),
    otherAgent: implementerOf({ agents: otherAgents, mountId: overlap.other.mountId }),
  });

  const send = async () => {
    const pending =
      attempt ?? notes?.map((note) => ({ ...note, itemId: crypto.randomUUID() })) ?? null;
    if (pending === null || isSending) {
      return;
    }
    setIsSending(true);
    setFailure(null);
    const outcome = await messageBothImplementers({ notes: pending });
    setIsSending(false);
    if (!outcome.isSent) {
      setFailure(outcome.failure);
      setAttempt(outcome.canRetry ? pending : null);
      return;
    }
    setAttempt(null);
    onSent();
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-body text-foreground">
        {words.files} {words.order}
      </p>
      {failure === null ? null : <p className="text-meta text-danger">{failure}</p>}
      {notes === null && attempt === null ? null : (
        <div className="flex">
          <Button
            variant="secondary"
            size="xs"
            intent={actionIntentOf({ verb: MESSAGE_BOTH })}
            isBusy={isSending}
            onClick={() => void send()}
          >
            {attempt === null ? MESSAGE_BOTH : 'Retry'}
          </Button>
        </div>
      )}
    </div>
  );
};
