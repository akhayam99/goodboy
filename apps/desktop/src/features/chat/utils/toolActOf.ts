import type { TranscriptItem } from './transcript-items';
import { toolFilePath } from './toolFilePath';
import { toolKind } from './toolKind';

type Params = {
  readonly item: Extract<TranscriptItem, { kind: 'tool_call' }>;
};

type InputParams = {
  readonly input: unknown;
};

type PathParams = {
  readonly path: string;
};

const MAX_COMMAND = 48;

const commandOf = ({ input }: InputParams): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const value: unknown = Reflect.get(input, 'command');
  const text = Array.isArray(value) ? value.join(' ') : value;
  if (typeof text !== 'string') {
    return null;
  }
  const line = text.split('\n')[0]?.trim() ?? '';
  if (line === '') {
    return null;
  }
  return line.length > MAX_COMMAND ? `${line.slice(0, MAX_COMMAND)}…` : line;
};

const baseName = ({ path }: PathParams): string => path.split(/[\\/]/).pop() ?? path;

export const toolActOf = ({ item }: Params): string => {
  const kind = toolKind({ toolName: item.toolName });
  const path = toolFilePath({ input: item.input });
  if (kind === 'command') {
    const command = commandOf({ input: item.input });
    return command === null ? 'Ran a command' : `Ran ${command}`;
  }
  if (kind === 'read' && path !== null) {
    return `Read ${baseName({ path })}`;
  }
  if (kind === 'edit' && path !== null) {
    return `Edited ${baseName({ path })}`;
  }
  if (kind === 'search') {
    return 'Searched the code';
  }
  if (kind === 'web') {
    return 'Searched the web';
  }
  if (kind === 'plan') {
    return 'Updated the plan';
  }
  return item.toolName;
};
