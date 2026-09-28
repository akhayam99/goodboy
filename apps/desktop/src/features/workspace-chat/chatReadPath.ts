import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly event: TurnEvent;
  readonly workingDir: string;
};

const PATH_KEYS = ['file_path', 'filePath', 'path'] as const;

type InputParams = {
  readonly input: unknown;
};

const pathOf = ({ input }: InputParams): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  for (const key of PATH_KEYS) {
    const value: unknown = Reflect.get(input, key);
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return null;
};

export const chatReadPath = ({ event, workingDir }: Params): string | null => {
  if (event.kind !== 'tool_call_start' || !/read/i.test(event.toolName)) {
    return null;
  }
  const path = pathOf({ input: event.input });
  if (path === null) {
    return null;
  }
  const folder = workingDir.replace(/\/+$/, '');
  return path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;
};
