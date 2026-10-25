import { invokeCommand } from '../invokeCommand';
import type { CloneDone, CloneRoute } from './repoCloneTypes';

type Params = {
  readonly requestId: string;
  readonly url: string;
  readonly destination: string;
  readonly route: CloneRoute;
};

export const cloneRepository = async ({
  requestId,
  url,
  destination,
  route,
}: Params): Promise<CloneDone> =>
  invokeCommand<CloneDone>('clone_repository', { requestId, url, destination, route });
