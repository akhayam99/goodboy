const RESTORE_CONFLICT_MESSAGE = 'A newer version arrived. Review it before restoring.';

export class RestoreConflictError extends Error {
  constructor() {
    super(RESTORE_CONFLICT_MESSAGE);
    this.name = 'RestoreConflictError';
  }
}
