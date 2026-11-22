import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { plainText } from '../../../../shared/utils/plainText';
import { sessionRowTitle } from '../../../../shared/utils/sessionTitle';

type Params = {
  readonly sessionIds: ReadonlyArray<SessionId>;
};

const NO_TASKS: ReadonlyArray<never> = [];

export const useSessionLabels = ({ sessionIds }: Params): ReadonlyMap<SessionId, string> => {
  const labels = useAppStore(
    useShallow((state) =>
      sessionIds.map((sessionId) => {
        const session = sessionById(state.sessions, sessionId) ?? null;
        const tasks = state.sessionExternalTasks[sessionId] ?? NO_TASKS;
        const { keys, title } = sessionRowTitle({ session, tasks });
        return keys[0] ?? plainText({ text: title });
      }),
    ),
  );
  return useMemo(
    () => new Map(sessionIds.map((sessionId, index) => [sessionId, labels[index] ?? ''])),
    [labels, sessionIds],
  );
};
