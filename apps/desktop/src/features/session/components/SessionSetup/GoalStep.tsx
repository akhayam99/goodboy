import { useState } from 'react';
import { Button, Textarea, formatError } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useSessionSlots } from '../../../../store';
import { SetupStepActions } from './SetupStepActions';

type Props = {
  readonly session: Session;
};

export const GoalStep = ({ session }: Props) => {
  const sessionId = session.id;
  const slots = useSessionSlots(sessionId);
  const saveSessionSetupGoal = useAppStore((state) => state.saveSessionSetupGoal);
  const skipSessionSetupStep = useAppStore((state) => state.skipSessionSetupStep);
  const closeSessionSetupStep = useAppStore((state) => state.closeSessionSetupStep);
  const savedGoal = slots.find((slot) => slot.key === 'goal')?.value ?? '';
  const [text, setText] = useState(savedGoal);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = text.trim();
  const isUntitled = session.goal.trim() === '';

  const save = async () => {
    if (trimmed === '' || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await saveSessionSetupGoal({ sessionId, goal: trimmed });
      closeSessionSetupStep({ sessionId });
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) {
            return;
          }
          event.preventDefault();
          void save();
        }}
        aria-label="Session goal"
        placeholder="What should this session get done?"
        minRows={2}
        maxRows={8}
        autoGrow
        className="text-body"
      />
      <SetupStepActions
        note={isUntitled ? 'The first sentence becomes the title.' : null}
        error={error}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => skipSessionSetupStep({ sessionId, step: 'goal' })}
        >
          Skip
        </Button>
        <Button
          size="sm"
          disabled={trimmed === ''}
          isBusy={isSaving}
          busyLabel="Saving goal"
          onClick={() => void save()}
        >
          Save goal
        </Button>
      </SetupStepActions>
    </div>
  );
};
