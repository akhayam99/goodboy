import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { readTerminalTail } from '../../../../shared/components/GenericTerminalPanel/terminalText';
import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { useHandOutputToAgent } from '../../../../shared/hooks/useHandOutputToAgent';

type Params = {
  readonly sessionId: SessionId | null;
  readonly tab: TerminalTab;
  readonly projectName: string | null;
  readonly branch: string | null;
};

type SelectionParams = {
  readonly text: string;
};

type SendParams = {
  readonly output: string;
};

export type TerminalOutputHandoff = {
  readonly canHandOff: boolean;
  readonly askLabel: string;
  readonly sendLastOutput: () => void;
  readonly sendSelection: (params: SelectionParams) => void;
};

const NO_TERMINAL_OUTPUT_NOTICE = 'This terminal has no output to send yet.';

export const useTerminalOutputHandoff = ({
  sessionId,
  tab,
  projectName,
  branch,
}: Params): TerminalOutputHandoff => {
  const { canHandOff, askLabel, handOff } = useHandOutputToAgent({ sessionId });
  const showToast = useShowToast();
  const subject = `terminal ${tab.title}`;

  const send = useCallback(
    ({ output }: SendParams) => handOff({ subject, outcome: null, projectName, branch, output }),
    [branch, handOff, projectName, subject],
  );

  const sendLastOutput = useCallback(() => {
    const output = readTerminalTail({ terminalId: tab.id }) ?? '';
    if (output.trim() === '') {
      showToast({ kind: 'warning', message: NO_TERMINAL_OUTPUT_NOTICE });
      return;
    }
    send({ output });
  }, [send, showToast, tab.id]);

  const sendSelection = useCallback(({ text }: SelectionParams) => send({ output: text }), [send]);

  return { canHandOff, askLabel, sendLastOutput, sendSelection };
};
