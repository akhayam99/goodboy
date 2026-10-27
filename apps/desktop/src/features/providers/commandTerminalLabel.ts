import type { DetectedTerminal } from '../../shared/lib/terminalApp';

type Params = {
  readonly saved: string | undefined;
  readonly detected: ReadonlyArray<DetectedTerminal>;
};

const SYSTEM_TERMINAL_LABEL = 'Terminal.app';

export const commandTerminalLabel = ({ saved, detected }: Params): string => {
  const chosen = detected.find((terminal) => terminal.id === saved && terminal.canRunCommand);
  return chosen?.label ?? SYSTEM_TERMINAL_LABEL;
};
