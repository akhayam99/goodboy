import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { usePromptFiles } from '../../../shared/hooks/usePromptFiles';
import { useAgentRouting } from '../hooks/useAgentRouting';
import { useAutoStart } from '../hooks/useAutoStart';
import { AUTO_PROVIDERS } from '../autoProviders';
import { AutoComposerView } from './AutoComposerView';

type Props = {
  readonly sessionId: SessionId;
  readonly actionsHost?: HTMLElement | null;
  readonly action?: HTMLElement | null;
  readonly footerClassName?: string;
  readonly onDone: () => void;
};

export const AutoComposer = ({
  sessionId,
  actionsHost,
  action,
  footerClassName,
  onDone,
}: Props) => {
  const goal = useAppStore((state) => state.newDrawerDrafts[sessionId]?.autoGoal ?? '');
  const setGoal = useAppStore((state) => state.setNewDrawerAutoGoal);
  const connected = useAppStore(
    useShallow((state) =>
      AUTO_PROVIDERS.filter((provider) =>
        state.providers.some((entry) => entry.id === provider && entry.connection === 'connected'),
      ),
    ),
  );
  const choice = useAgentRouting({ sessionId, kind: 'generic' });
  const start = useAutoStart({ sessionId });
  const files = usePromptFiles({ note: 'Files go to Auto' });
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStartingRef = useRef(false);

  const submit = async (): Promise<void> => {
    if (goal.trim() === '' || isStartingRef.current) {
      return;
    }
    isStartingRef.current = true;
    setIsStarting(true);
    setError(null);
    try {
      await start({ goal, routing: choice.effective });
      setGoal({ sessionId, goal: '' });
      files.clear();
      choice.reset();
      onDone();
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  };

  return (
    <AutoComposerView
      goal={goal}
      promptFiles={files}
      connected={connected}
      choice={choice}
      isStarting={isStarting}
      error={error}
      {...(actionsHost !== undefined && { actionsHost })}
      {...(action !== undefined && { action })}
      {...(footerClassName !== undefined && { footerClassName })}
      onGoalChange={(next) => setGoal({ sessionId, goal: next })}
      onSubmit={() => void submit()}
      onDiscard={() => {
        setGoal({ sessionId, goal: '' });
        files.clear();
      }}
    />
  );
};
