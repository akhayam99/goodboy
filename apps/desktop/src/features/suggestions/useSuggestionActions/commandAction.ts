import type { MountId, SessionId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import type { MoveCommand } from '../types';
import type { SuggestionActions } from '.';

type OpenParams = {
  readonly cwd: string;
  readonly prefill: string;
};

type RunParams = {
  readonly sessionId: SessionId;
  readonly scriptId: string;
  readonly name: string;
  readonly command: string;
  readonly cwd: string;
  readonly mountId: MountId;
};

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly name: string;
  readonly command: MoveCommand;
  readonly failureTitle: string;
  readonly openTerminal: (params: OpenParams) => void;
  readonly runScript: (params: RunParams) => Promise<{ readonly exitCode: number }>;
};

export const commandAction = ({
  sessionId,
  mountId,
  name,
  command,
  failureTitle,
  openTerminal,
  runScript,
}: Params): SuggestionActions['primary'] => {
  if (command.mode === 'type') {
    return {
      label: NAMES.addToPrompt,
      isDisabled: false,
      failureTitle,
      run: async () => {
        openTerminal({ cwd: command.cwd, prefill: command.text });
      },
    };
  }
  return {
    label: NAMES.runScript,
    isDisabled: false,
    failureTitle,
    run: async () => {
      const result = await runScript({
        sessionId,
        scriptId: command.scriptId ?? name,
        name,
        command: command.text,
        cwd: command.cwd,
        mountId,
      });
      if (result.exitCode !== 0) {
        throw new Error(`${name} exited with code ${result.exitCode}`);
      }
    },
  };
};
