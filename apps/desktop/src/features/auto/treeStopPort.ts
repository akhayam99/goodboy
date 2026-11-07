import { createPort } from './createPort';

export type TreeStopResult = 'stopped' | 'stuck' | 'not_owner';

type StopParams = {
  readonly treeId: string;
};

export type TreeStopPort = (params: StopParams) => Promise<TreeStopResult>;

const slot = createPort<TreeStopPort>();

export const registerTreeStopPort = slot.register;

export const currentTreeStopPort = slot.current;
