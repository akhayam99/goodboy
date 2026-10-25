export const STALE_MOUNT_ERROR_NAME = 'StaleMountError';

export const createStaleMountError = (): Error => {
  const error = new Error('This repository changed branch before the fix started');
  error.name = STALE_MOUNT_ERROR_NAME;
  return error;
};
