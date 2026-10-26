import { STALE_MOUNT_ERROR_NAME } from './createStaleMountError';

type Params = { readonly error: unknown };

export const isStaleMountError = ({ error }: Params): boolean =>
  error instanceof Error && error.name === STALE_MOUNT_ERROR_NAME;
