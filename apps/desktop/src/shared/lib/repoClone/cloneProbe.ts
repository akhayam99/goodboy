import { invokeCommand } from '../invokeCommand';
import type { CloneProbe } from './repoCloneTypes';

type Params = {
  readonly url: string;
  readonly destination: string;
};

export const cloneProbe = async ({ url, destination }: Params): Promise<CloneProbe> =>
  invokeCommand<CloneProbe>('clone_probe', { url, destination });
