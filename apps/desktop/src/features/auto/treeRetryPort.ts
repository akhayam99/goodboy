import { createPort } from './createPort';

export type TreeRetryResult =
  Readonly<{ kind: 'retried' }> | Readonly<{ kind: 'refused'; message: string }>;

type RetryParams = {
  readonly treeId: string;
};

export type TreeRetryPort = (params: RetryParams) => Promise<TreeRetryResult>;

const slot = createPort<TreeRetryPort>();

export const registerTreeRetryPort = slot.register;

export const currentTreeRetryPort = slot.current;
