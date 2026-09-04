import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button, cn, formatError, Textarea } from '@goodboy/ui';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { LaunchedNotice } from './LaunchedNotice';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type ExternalTask = {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly identifier: string;
  readonly url: string;
  readonly title: string;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly linkedSessionId: SessionId | null;
  readonly goalSeed: string;
  readonly externalTask: ExternalTask;
  readonly onClose: () => void;
};

export const LaunchSessionPanel = ({
  workspaceId,
  linkedSessionId,
  goalSeed,
  externalTask,
  onClose,
}: Props) => {
  const createSession = useAppStore((state) => state.createSession);
  const { showToast } = useToast();
  const [goal, setGoal] = useState(goalSeed);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goalSeedRef = useRef(goalSeed);

  useEffect(() => {
    const previousSeed = goalSeedRef.current;
    goalSeedRef.current = goalSeed;
    setGoal((current) => (current === previousSeed ? goalSeed : current));
  }, [goalSeed]);

  const canLaunch = goal.trim() !== '' && !isBusy;

  const launch = async () => {
    setError(null);
    setBusy(true);
    try {
      const { session } = await createSession({
        workspaceId,
        goal,
        externalTasks: [externalTask],
      });
      showToast('success', `Session created: ${session.goal}`);
      onClose();
    } catch (launchError) {
      setError(formatError(launchError));
    } finally {
      setBusy(false);
    }
  };

  const onGoalKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) {
      return;
    }
    event.preventDefault();
    if (!canLaunch) {
      return;
    }
    void launch();
  };

  if (linkedSessionId != null) {
    return <LaunchedNotice sessionId={linkedSessionId} isLinkedToIssue onOpened={onClose} />;
  }

  return (
    <section
      aria-label="Launch session"
      className="flex flex-col gap-1 rounded-md bg-subtle/80 p-2 ring-1 ring-border-soft motion-safe:transition-shadow focus-within:ring-2 focus-within:ring-primary/40"
    >
      <Textarea
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        onKeyDown={onGoalKeyDown}
        autoGrow
        minRows={2}
        maxRows={10}
        disabled={isBusy}
        aria-label="Session goal"
        placeholder="What should this session do?"
        className="border-0 bg-transparent px-2 leading-relaxed shadow-none focus-visible:shadow-none focus-visible:ring-0"
      />

      {error != null ? (
        <span
          role="alert"
          className="flex items-start gap-1.5 px-2 text-2xs leading-relaxed text-danger"
        >
          <AlertTriangle size={ICON_SIZE.row} aria-hidden className="mt-0.5 shrink-0" />
          {error}
        </span>
      ) : null}

      <footer className="flex items-center justify-end px-1">
        <Button
          size="sm"
          onClick={() => void launch()}
          disabled={!canLaunch}
          className={cn('shrink-0', isBusy && 'animate-border-pulse')}
        >
          {isBusy ? 'Launching…' : 'Launch session'}
          {!isBusy ? <ArrowRight size={ICON_SIZE.row} aria-hidden /> : null}
        </Button>
      </footer>
    </section>
  );
};
