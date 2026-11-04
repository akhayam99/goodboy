export type WithdrawResult =
  | Readonly<{ kind: 'withdrawn' }>
  | Readonly<{ kind: 'delivered' }>
  | Readonly<{ kind: 'refused'; message: string }>;

export type WithdrawParams = {
  readonly treeId: string;
  readonly rowId: string;
};

export type WithdrawPort = (params: WithdrawParams) => Promise<WithdrawResult>;

type Registry = {
  port: WithdrawPort | null;
};

const registry: Registry = { port: null };

type RegisterParams = {
  readonly port: WithdrawPort | null;
};

export const registerWithdrawPort = ({ port }: RegisterParams): void => {
  registry.port = port;
};

export const currentWithdrawPort = (): WithdrawPort | null => registry.port;
