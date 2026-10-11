type TrackParams = {
  readonly terminalId: string;
  readonly data: string;
};

type IdParams = {
  readonly terminalId: string;
};

const ESCAPE = '\u001b';
const BACKSPACE = '\u007f';

const buffers = new Map<string, string>();
const lastCommands = new Map<string, string>();

export const trackTerminalInput = ({ terminalId, data }: TrackParams): void => {
  if (data.startsWith(ESCAPE)) {
    return;
  }
  let buffer = buffers.get(terminalId) ?? '';
  for (const char of data) {
    if (char === '\r' || char === '\n') {
      const command = buffer.trim();
      if (command !== '') {
        lastCommands.set(terminalId, command);
      }
      buffer = '';
      continue;
    }
    if (char === BACKSPACE) {
      buffer = buffer.slice(0, -1);
      continue;
    }
    if (char >= ' ') {
      buffer += char;
    }
  }
  buffers.set(terminalId, buffer);
};

export const lastCommandOf = ({ terminalId }: IdParams): string | null =>
  lastCommands.get(terminalId) ?? null;

export const forgetTerminalCommand = ({ terminalId }: IdParams): void => {
  buffers.delete(terminalId);
  lastCommands.delete(terminalId);
};
