import type { ReportErrorParams } from '../../store/slices/notifications/reportError';
import { invokeCommand } from './invokeCommand';
import { OPEN_APP_SETTINGS_GENERAL } from '../../store/slices/notifications/errorRecovery';

export type DetectedTerminal = {
  readonly id: string;
  readonly label: string;
  readonly canRunCommand: boolean;
};

export const detectTerminals = async (): Promise<ReadonlyArray<DetectedTerminal>> => {
  return invokeCommand<DetectedTerminal[]>('detect_terminals');
};

type OpenInTerminalAppParams = {
  readonly path: string;
};

const openInTerminalApp = async ({ path }: OpenInTerminalAppParams): Promise<void> => {
  await invokeCommand('open_in_external_terminal', { path });
};

type OpenInConfiguredTerminalParams = {
  readonly path: string;
  readonly state: {
    readonly reportError: (params: ReportErrorParams) => Promise<void> | void;
  };
};

export const openInConfiguredTerminal = async ({
  path,
  state,
}: OpenInConfiguredTerminalParams): Promise<void> => {
  try {
    await openInTerminalApp({ path });
  } catch (error) {
    void state.reportError({
      title: "Couldn't open your terminal app",
      error,
      recovery: OPEN_APP_SETTINGS_GENERAL,
    });
  }
};
