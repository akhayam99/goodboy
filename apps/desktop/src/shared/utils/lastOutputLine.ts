const CARRIAGE_RETURN = /\r(?!\n)/;

type Params = {
  readonly output: string | undefined;
};

export const lastOutputLine = ({ output }: Params): string | null => {
  if (output === undefined) {
    return null;
  }
  const lines = output.split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const segments = (lines[index] ?? '').split(CARRIAGE_RETURN);
    for (let inner = segments.length - 1; inner >= 0; inner -= 1) {
      const text = (segments[inner] ?? '').trim();
      if (text !== '') {
        return text;
      }
    }
  }
  return null;
};
