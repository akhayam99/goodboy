const REJECTION_FLAG = 'isDemoIpcRejection';

type RejectionParams = {
  readonly message: string;
};

type ErrorParams = {
  readonly error: unknown;
};

export const demoIpcRejection = ({ message }: RejectionParams): Error =>
  Object.assign(new Error(message), { [REJECTION_FLAG]: true });

export const isDemoIpcRejection = ({ error }: ErrorParams): boolean =>
  error instanceof Error && Reflect.get(error, REJECTION_FLAG) === true;
