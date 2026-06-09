import { invoke } from '@tauri-apps/api/core';

// Thin TS binding for the optional "open command in OS terminal" escape
// hatch. Primary install/connect flow runs inside Goodboy via provider_
// lifecycle; this is offered in the modal for users who prefer their own
// shell or who hit something the embedded PTY cannot handle (sudo prompts
// on systems without TouchID, etc).
export const openCommandInExternalTerminal = async (command: string): Promise<void> => {
  await invoke('open_command_in_external_terminal', { command });
};
