import { toolFilePath } from '../chat/utils/toolFilePath';

const SUBJECT_LIMIT = 80;

type Params = {
  readonly toolName: string;
  readonly input: unknown;
};

type CommandParams = {
  readonly input: unknown;
};

const commandOf = ({ input }: CommandParams): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const value: unknown = Reflect.get(input, 'command');
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

type ClipParams = {
  readonly text: string;
};

const clipped = ({ text }: ClipParams): string =>
  text.length > SUBJECT_LIMIT ? `${text.slice(0, SUBJECT_LIMIT - 1)}…` : text;

export const permissionSubjectOf = ({ toolName, input }: Params): string | null => {
  const command = toolName === 'Bash' ? commandOf({ input }) : null;
  if (command !== null) {
    return clipped({ text: command });
  }
  const path = toolFilePath({ input });
  return path === null ? null : clipped({ text: path });
};
