export type ChecksRerunResult =
  | Readonly<{ kind: 'rerun'; verdict: 'green' | 'red' | 'not_checked' }>
  | Readonly<{ kind: 'refused'; message: string }>;

type RerunParams = {
  readonly delegationId: string;
};

export type ChecksRerunPort = (params: RerunParams) => Promise<ChecksRerunResult>;

type Registry = {
  port: ChecksRerunPort | null;
};

const registry: Registry = { port: null };

type RegisterParams = {
  readonly port: ChecksRerunPort | null;
};

export const registerChecksRerunPort = ({ port }: RegisterParams): void => {
  registry.port = port;
};

export const currentChecksRerunPort = (): ChecksRerunPort | null => registry.port;
