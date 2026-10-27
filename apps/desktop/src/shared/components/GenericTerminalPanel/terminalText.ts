type BufferLine = {
  readonly isWrapped: boolean;
  translateToString(shouldTrimRight?: boolean): string;
};

type TextBuffer = {
  readonly length: number;
  getLine(index: number): BufferLine | undefined;
};

type TerminalTextReader = () => string;

type BufferParams = {
  readonly buffer: TextBuffer;
};

type RegisterParams = {
  readonly terminalId: string;
  readonly reader: TerminalTextReader;
};

type TerminalIdParams = {
  readonly terminalId: string;
};

const readers = new Map<string, TerminalTextReader>();

export const bufferText = ({ buffer }: BufferParams): string => {
  const lines: string[] = [];
  for (let index = 0; index < buffer.length; index += 1) {
    const line = buffer.getLine(index);
    if (line === undefined) {
      continue;
    }
    const text = line.translateToString(true);
    const previous = lines.length - 1;
    if (line.isWrapped && previous >= 0) {
      lines[previous] = `${lines[previous] ?? ''}${text}`;
      continue;
    }
    lines.push(text);
  }
  while (lines.length > 0 && (lines[lines.length - 1] ?? '').trim() === '') {
    lines.pop();
  }
  return lines.join('\n');
};

export const registerTerminalText = ({ terminalId, reader }: RegisterParams): (() => void) => {
  readers.set(terminalId, reader);
  return () => {
    if (readers.get(terminalId) === reader) {
      readers.delete(terminalId);
    }
  };
};

export const readTerminalTail = ({ terminalId }: TerminalIdParams): string | null =>
  readers.get(terminalId)?.() ?? null;
