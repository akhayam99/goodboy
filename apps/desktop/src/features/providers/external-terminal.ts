import { invokeCommand } from '../../shared/lib/invokeCommand';

export const openCommandInExternalTerminal = async (command: string): Promise<void> => {
  await invokeCommand('open_command_in_external_terminal', { command });
};
