export type NewerDatabase = {
  readonly restorableSnapshot: string | null;
};

type NewerDatabaseErrorParams = {
  readonly message: string;
  readonly restorableSnapshot: string | null;
};

export class NewerDatabaseError extends Error {
  public readonly restorableSnapshot: string | null;

  constructor({ message, restorableSnapshot }: NewerDatabaseErrorParams) {
    super(message);
    this.name = 'NewerDatabaseError';
    this.restorableSnapshot = restorableSnapshot;
  }
}

type NewerDatabaseFromErrorParams = {
  readonly error: unknown;
};

export const newerDatabaseFromError = ({
  error,
}: NewerDatabaseFromErrorParams): NewerDatabase | null => {
  if (!(error instanceof NewerDatabaseError)) {
    return null;
  }
  return { restorableSnapshot: error.restorableSnapshot };
};
