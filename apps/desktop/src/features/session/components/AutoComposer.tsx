import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AUTO_OWN_PROVIDERS } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { usePromptFiles } from '../../../shared/hooks/usePromptFiles';
import { useAgentRouting } from '../hooks/useAgentRouting';
import { useAutoStart } from '../hooks/useAutoStart';
import { useConfirmStartMode } from '../../auto/useConfirmStartMode';
import { useAutoTreeLimit } from '../../auto/useAutoTreeLimit';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { autoOwnRouting } from '../../auto/autoOwnRouting';
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
      AUTO_OWN_PROVIDERS.filter((provider) =>
        state.providers.some((entry) => entry.id === provider && entry.connection === 'connected'),
      ),
    ),
  );
  const routed = useAgentRouting({ sessionId, kind: 'auto' });
  const choice = {
    ...routed,
    effective: autoOwnRouting({ routing: routed.effective }),
    suggestion: autoOwnRouting({ routing: routed.suggestion }),
  };
  const start = useAutoStart({ sessionId });
  const confirmMode = useConfirmStartMode();
  const workspaceId = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.workspaceId ?? null,
  );
  const limit = useAutoTreeLimit({ workspaceId, sessionId });
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
      if (!(await confirmMode({ isShown: true }))) {
        return;
      }
      await limit.persist();
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
      limit={limit}
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
