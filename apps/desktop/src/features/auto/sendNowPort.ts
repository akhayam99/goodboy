import type { TreeRetryResult } from './treeRetryPort';
import { createPort } from './createPort';

type SendNowResult = TreeRetryResult;

type SendNowParams = {
  readonly treeId: string;
  readonly rowId: string;
};

export type SendNowPort = (params: SendNowParams) => Promise<SendNowResult>;

const slot = createPort<SendNowPort>();

export const registerSendNowPort = slot.register;

export const currentSendNowPort = slot.current;
