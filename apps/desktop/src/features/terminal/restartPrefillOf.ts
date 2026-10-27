import type { TerminalTab } from '../../shared/types/terminal';

type Params = {
  readonly tab: Pick<TerminalTab, 'openError'>;
  readonly command: string | null;
};

const LEAVES_THE_SHELL = /^(?:exit|logout)(?:\s|$)/;

export const restartPrefillOf = ({ tab, command }: Params): string | null => {
  if (tab.openError !== undefined || command === null || LEAVES_THE_SHELL.test(command)) {
    return null;
  }
  return `${command}\r`;
};
