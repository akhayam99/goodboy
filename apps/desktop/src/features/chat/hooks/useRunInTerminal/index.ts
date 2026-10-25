import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { isLiveSession } from '../../../../shared/utils/isLiveSession';
import { openSessionTerminal } from '../../../terminal/openSessionTerminal';
import { typedCommandOf } from '../../../terminal/typedCommandOf';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Params = {
  readonly sessionId: SessionId | null;
};

type RunInTerminalParams = {
  readonly command: string;
  readonly cwd: string | null;
};

export type RunInTerminal = {
  readonly canRun: boolean;
  readonly run: (params: RunInTerminalParams) => void;
};

export const RUN_IN_TERMINAL_LABEL = 'Run in terminal';

export const useRunInTerminal = ({ sessionId }: Params): RunInTerminal => {
  const isLive = useAppStore(
    (state) =>
      sessionId !== null && isLiveSession({ session: sessionById(state.sessions, sessionId) }),
  );

  const run = useCallback(
    ({ command, cwd }: RunInTerminalParams) => {
      const prefill = typedCommandOf({ text: command });
      if (sessionId === null || !isLive || prefill === '') {
        return;
      }
      const state = useAppStore.getState();
      openSessionTerminal({
        state,
        sessionId,
        cwd: cwd ?? state.sessionWorktrees[sessionId]?.[0] ?? null,
        prefill,
      });
    },
    [isLive, sessionId],
  );

  return { canRun: sessionId !== null && isLive, run };
};
