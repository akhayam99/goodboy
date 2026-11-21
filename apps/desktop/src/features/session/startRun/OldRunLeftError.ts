type Params = {
  readonly message: string;
  readonly failure: unknown;
  readonly endOldRun: () => Promise<void>;
};

export class OldRunLeftError extends Error {
  readonly failure: unknown;
  readonly endOldRun: () => Promise<void>;

  constructor({ message, failure, endOldRun }: Params) {
    super(message);
    this.name = 'OldRunLeftError';
    this.failure = failure;
    this.endOldRun = endOldRun;
  }
}
