import { invoke } from '@tauri-apps/api/core';

export const openCommandInExternalTerminal = async (command: string): Promise<void> => {
  await invoke('open_command_in_external_terminal', { command });
};
