import { createPort } from './createPort';

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

const slot = createPort<PublishPort>();

export const registerPublishPort = slot.register;

export const currentPublishPort = slot.current;
