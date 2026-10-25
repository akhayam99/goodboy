import { invokeCommand } from '../invokeCommand';

type Params = {
  readonly path: string;
};

export const cloneFreeDestination = async ({ path }: Params): Promise<string | null> =>
  invokeCommand<string | null>('clone_free_destination', { path });
