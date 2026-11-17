import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { openSessionTerminal } from '../terminal/openSessionTerminal';
import { scriptCommandOf } from '../terminal/scriptCommandOf';
import type { RunnableScript, SessionScriptGroup } from './buildSessionScripts';

type Params = {
  readonly sessionId: SessionId;
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
  readonly savedBody: string | null;
};

export const openScriptInTerminal = ({ sessionId, group, script, savedBody }: Params): void => {
  openSessionTerminal({
    state: useAppStore.getState(),
    sessionId,
    cwd: group.worktreePath,
    prefill: scriptCommandOf({
      script: { invocation: savedBody ?? script.invocation, relDir: script.relDir },
    }),
  });
};
