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

type SessionLabels = {
  readonly labels: ReadonlyMap<SessionId, string>;
  readonly titles: ReadonlyMap<SessionId, string>;
};

const NO_TASKS: ReadonlyArray<never> = [];

export const useSessionLabels = ({ sessionIds }: Params): SessionLabels => {
  const pairs = useAppStore(
    useShallow((state) =>
      sessionIds.flatMap((sessionId) => {
        const session = sessionById(state.sessions, sessionId) ?? null;
        const tasks = state.sessionExternalTasks[sessionId] ?? NO_TASKS;
        const { keys, title } = sessionRowTitle({ session, tasks });
        const plain = plainText({ text: title });
        return [keys[0] ?? plain, plain];
      }),
    ),
  );
  return useMemo(
    () => ({
      labels: new Map(sessionIds.map((sessionId, index) => [sessionId, pairs[index * 2] ?? ''])),
      titles: new Map(
        sessionIds.map((sessionId, index) => [sessionId, pairs[index * 2 + 1] ?? '']),
      ),
    }),
    [pairs, sessionIds],
  );
};
