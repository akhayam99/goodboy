import { createPort } from './createPort';

export type WithdrawResult =
  | Readonly<{ kind: 'withdrawn' }>
  | Readonly<{ kind: 'delivered' }>
  | Readonly<{ kind: 'refused'; message: string }>;

export type WithdrawParams = {
  readonly treeId: string;
  readonly rowId: string;
};

export type WithdrawPort = (params: WithdrawParams) => Promise<WithdrawResult>;

const slot = createPort<WithdrawPort>();

export const registerWithdrawPort = slot.register;

export const currentWithdrawPort = slot.current;
