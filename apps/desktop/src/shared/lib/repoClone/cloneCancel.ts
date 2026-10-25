import { invokeCommand } from '../invokeCommand';

type Params = {
  readonly requestId: string;
};

export const cloneCancel = async ({ requestId }: Params): Promise<void> =>
  invokeCommand<void>('clone_cancel', { requestId });
