export type TreeRetryResult =
  Readonly<{ kind: 'retried' }> | Readonly<{ kind: 'refused'; message: string }>;

type RetryParams = {
  readonly treeId: string;
};

export type TreeRetryPort = (params: RetryParams) => Promise<TreeRetryResult>;

type Registry = {
  port: TreeRetryPort | null;
};

const registry: Registry = { port: null };

type RegisterParams = {
  readonly port: TreeRetryPort | null;
};

export const registerTreeRetryPort = ({ port }: RegisterParams): void => {
  registry.port = port;
};

export const currentTreeRetryPort = (): TreeRetryPort | null => registry.port;
