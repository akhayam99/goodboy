import { formatError } from '@goodboy/ui';

export const isMissingBaseRefError = (err: unknown): boolean =>
  /cannot find base ref|cannot resolve merge-base/i.test(formatError(err));
