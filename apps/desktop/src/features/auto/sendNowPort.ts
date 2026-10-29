import type { TreeRetryResult } from './treeRetryPort';

export type SendNowResult = TreeRetryResult;

type SendNowParams = {
  readonly treeId: string;
  readonly rowId: string;
};

export type SendNowPort = (params: SendNowParams) => Promise<SendNowResult>;

type Registry = {
  port: SendNowPort | null;
};

const registry: Registry = { port: null };

type RegisterParams = {
  readonly port: SendNowPort | null;
};

export const registerSendNowPort = ({ port }: RegisterParams): void => {
  registry.port = port;
};

export const currentSendNowPort = (): SendNowPort | null => registry.port;
