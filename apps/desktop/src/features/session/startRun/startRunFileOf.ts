export type StartRunFile = Readonly<{
  relPath: string;
  absolutePath: string;
}>;

type Params = {
  readonly event: Event;
};

const isFileDetail = (value: unknown): value is Readonly<{ file: StartRunFile }> => {
  if (typeof value !== 'object' || value === null || !('file' in value)) {
    return false;
  }
  const file: unknown = value.file;
  return (
    typeof file === 'object' &&
    file !== null &&
    'relPath' in file &&
    typeof file.relPath === 'string' &&
    'absolutePath' in file &&
    typeof file.absolutePath === 'string'
  );
};

export const startRunFileOf = ({ event }: Params): StartRunFile | null => {
  if (!(event instanceof CustomEvent)) {
    return null;
  }
  const detail: unknown = event.detail;
  return isFileDetail(detail) ? detail.file : null;
};
