import { useEffect, useRef, useState } from 'react';
import { Button, FormActions, Input, Notice, Textarea, formatError } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionSlots } from '../../../../store/slices/slots/selectors';
import type {
  IssueBriefEntry,
  IssueBriefSource,
} from '../../../../store/slices/issue-briefs/types';
import { applyGoalFromWork } from '../../../../store/slices/issue-briefs/applyGoalFromWork';
import { BriefMeta } from '../SessionKickoff/IssueBriefProposal/BriefMeta';
import { BriefFailed } from '../SessionKickoff/IssueBriefProposal/BriefFailed';

type Props = {
  readonly session: Session;
  readonly sources: ReadonlyArray<IssueBriefSource>;
  readonly linkedCount?: number;
  readonly entry: IssueBriefEntry | null;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
  readonly onUsed: () => void;
};

export const GoalFromWorkCard = ({
  session,
  sources,
  linkedCount = sources.length,
  entry,
  onRetry,
  onDismiss,
  onUsed,
}: Props) => {
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  const currentEntry = useRef(entry);
  currentEntry.current = entry;
  const slots = useSessionSlots(session.id);
  const currentGoal = slots.find((slot) => slot.key === 'goal')?.value ?? '';
  const hasTitle = session.goal.trim() !== '' && session.goal !== 'Untitled session';
  const shouldReplace = hasTitle || currentGoal.trim() !== '';
  useEffect(() => {
    if (entry?.status === 'ready') {
      setTitle(entry.brief.title.slice(0, 60));
      setGoal(entry.brief.goal);
    }
  }, [entry]);
  const useProposal = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await applyGoalFromWork({ sessionId: session.id, title: title.trim(), goal: goal.trim() });
      if (isMounted.current && currentEntry.current === entry) {
        onUsed();
      }
    } catch (cause) {
      if (!isMounted.current || currentEntry.current !== entry) {
        return;
      }
      setError(formatError(cause));
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  };
  const unread = sources
    .filter((source) => source.body.trim() === '')
    .map((source) => source.identifier);
  const first = sources[0];
  return (
    <section
      aria-label="Title and goal from linked work"
      className="flex flex-col gap-3 rounded-md border border-border-soft bg-subtle p-3"
    >
      {entry === null || entry.status === 'loading' ? (
        <span role="status" className="text-meta text-shimmer">
          Writing the title and goal
        </span>
      ) : null}
      {entry?.status === 'failed' && first !== undefined ? (
        <BriefFailed source={first} entry={entry} onRetry={onRetry} />
      ) : null}
      {entry?.status === 'unavailable' ? (
        <Notice
          tone="warning"
          placement="inline"
          title="A brief needs an available model"
          body="Connect a provider or try again when a model is free."
          actions={
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      ) : null}
      {linkedCount > sources.length ? (
        <p className="text-meta text-muted-foreground">Based on the first five linked issues.</p>
      ) : null}
      {entry?.status === 'ready' ? (
        <>
          <label className="flex flex-col gap-1 text-label">
            Title
            {hasTitle ? (
              <span className="text-meta text-muted-foreground">Now: {session.goal}</span>
            ) : null}
            <Input
              aria-label="Proposed title"
              value={title}
              maxLength={60}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isSaving}
            />
          </label>
          <label className="flex flex-col gap-1 text-label">
            Goal
            {currentGoal.trim() !== '' ? (
              <span className="text-meta text-muted-foreground">Now: {currentGoal}</span>
            ) : null}
            <Textarea
              aria-label="Proposed goal"
              value={goal}
              rows={3}
              onChange={(event) => setGoal(event.target.value)}
              disabled={isSaving}
            />
          </label>
          <BriefMeta route={entry.route} durationMs={entry.durationMs} costUsd={entry.costUsd} />
          {unread.length > 0 ? (
            <p className="text-meta text-muted-foreground">
              Based on the titles of {unread.join(' and ')}.{' '}
              {unread.length === 1
                ? 'Its text could not be read.'
                : 'Their text could not be read.'}
            </p>
          ) : null}
        </>
      ) : null}
      {error !== null ? (
        <Notice
          role="alert"
          tone="danger"
          placement="inline"
          title="Couldn't save the title and goal"
          body={error}
          actions={
            <Button
              size="sm"
              variant="secondary"
              disabled={isSaving}
              onClick={() => void useProposal()}
            >
              Retry
            </Button>
          }
        />
      ) : null}
      <FormActions>
        <Button variant="ghost" size="sm" disabled={isSaving} onClick={onDismiss}>
          Dismiss
        </Button>
        {entry?.status === 'ready' ? (
          <Button
            size="sm"
            disabled={isSaving || title.trim() === '' || goal.trim() === ''}
            onClick={() => void useProposal()}
          >
            {isSaving ? 'Saving' : shouldReplace ? 'Replace' : 'Use title and goal'}
          </Button>
        ) : null}
      </FormActions>
    </section>
  );
};
