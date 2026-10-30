type Params = Readonly<{
  message: string;
}>;

export class RunStepMountBlockedError extends Error {
  constructor({ message }: Params) {
    super(message);
    this.name = 'RunStepMountBlockedError';
  }
}
