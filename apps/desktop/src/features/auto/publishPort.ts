export type PublishAct = 'confirm' | 'decline' | 'retry' | 'put_back';

type PublishRowState =
  'pushing' | 'awaiting_confirm' | 'pushed' | 'declined' | 'failed' | 'put_back' | 'refused';

export type PublishRowResult = Readonly<{
  delegationId: string;
  state: PublishRowState;
  message: string | null;
}>;

export type PublishResult = Readonly<{
  kind: 'done';
  rows: ReadonlyArray<PublishRowResult>;
}>;

type ActParams = {
  readonly act: PublishAct;
  readonly delegationIds: ReadonlyArray<string>;
};

export type PublishPort = (params: ActParams) => Promise<PublishResult>;

type Registry = {
  port: PublishPort | null;
};

const registry: Registry = { port: null };

type RegisterParams = {
  readonly port: PublishPort | null;
};

export const registerPublishPort = ({ port }: RegisterParams): void => {
  registry.port = port;
};

export const currentPublishPort = (): PublishPort | null => registry.port;
