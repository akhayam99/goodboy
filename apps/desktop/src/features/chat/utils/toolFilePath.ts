const PATH_KEYS = ['file_path', 'path', 'target_file', 'notebook_path', 'filename'] as const;

type Params = {
  readonly input: unknown;
};

export const toolFilePath = ({ input }: Params): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  for (const key of PATH_KEYS) {
    const value: unknown = Reflect.get(input, key);
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
};
