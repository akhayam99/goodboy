import { formatError } from '@goodboy/ui';

const MISSING_FILE = /\(os error 2\)$/;

type Params = {
  readonly error: unknown;
  readonly title: string;
};

export const importFailureTitleOf = ({ error, title }: Params): string =>
  MISSING_FILE.test(formatError(error).trim()) ? "Couldn't find the backup file" : title;
