import { invokeCommand } from '../../shared/lib/invokeCommand';

type Params = {
  readonly sessionId: string;
  readonly path: string;
};

export const readLocalImage = async ({ sessionId, path }: Params): Promise<string> => {
  return invokeCommand<string>('local_image_read', { sessionId, path });
};
