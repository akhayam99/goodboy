export type TreeStopResult = 'stopped' | 'stuck' | 'not_owner';

type StopParams = {
  readonly treeId: string;
};

export type TreeStopPort = (params: StopParams) => Promise<TreeStopResult>;

type Registry = {
  port: TreeStopPort | null;
};

const registry: Registry = { port: null };

type RegisterParams = {
  readonly port: TreeStopPort | null;
};

export const registerTreeStopPort = ({ port }: RegisterParams): void => {
  registry.port = port;
};

export const currentTreeStopPort = (): TreeStopPort | null => registry.port;
