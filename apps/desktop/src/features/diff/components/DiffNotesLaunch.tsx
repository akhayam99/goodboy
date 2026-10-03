import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { FIRST_LAP_REFUSAL, selectFirstLapProject } from '../../../store/slices/bootstrap/firstLap';
import { modelLabel } from '../../chat/utils/chat-constants';
import { ReviewLaunchStrip } from '../../resolve/ReviewLaunchStrip';
import { REVIEW_LAUNCH_LABEL, startedLine } from '../../resolve/reviewLaunchCopy';

type Props = {
  readonly sessionId: SessionId;
};

type Started = {
  readonly count: number;
  readonly model: string;
};

export const DiffNotesLaunch = ({ sessionId }: Props) => {
  const threadIds = useAppStore((s) => s.diffNoteLaunch[sessionId] ?? null);
  const isFirstLap = useAppStore((s) => selectFirstLapProject({ state: s, sessionId }) !== null);
  const closeDiffNoteLaunch = useAppStore((s) => s.closeDiffNoteLaunch);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const [started, setStarted] = useState<string | null>(null);

  const close = useCallback(
    () => closeDiffNoteLaunch({ sessionId }),
    [closeDiffNoteLaunch, sessionId],
  );

  const onStarted = useCallback(
    ({ count, model }: Started): void => {
      close();
      setStarted(startedLine({ count, modelName: modelLabel(model) }));
      openDrawer({ kind: 'diff-notes', sessionId, payload: {} });
    },
    [close, openDrawer, sessionId],
  );

  return (
    <>
      <p role="status" className="sr-only">
        {started ?? ''}
      </p>
      {threadIds === null ? null : isFirstLap ? (
        <section
          aria-label={REVIEW_LAUNCH_LABEL.strip}
          className="flex min-w-0 items-start gap-2 rounded-lg bg-subtle px-4 py-3"
        >
          <p role="alert" className="min-w-0 flex-1 text-body text-muted-foreground">
            {FIRST_LAP_REFUSAL}
          </p>
          <IconButton icon={X} label={REVIEW_LAUNCH_LABEL.close} variant="ghost" onClick={close} />
        </section>
      ) : (
        <ReviewLaunchStrip
          key={threadIds.join('|')}
          sessionId={sessionId}
          threadIds={threadIds}
          onClose={close}
          onStarted={onStarted}
          noun="note"
        />
      )}
    </>
  );
};
