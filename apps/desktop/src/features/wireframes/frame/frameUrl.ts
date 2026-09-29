import type { ProviderPlatform } from '@goodboy/types';
import { currentPlatform } from '../../../shared/platform';

const frameOrigin = ({ platform }: { readonly platform: ProviderPlatform }): string =>
  platform === 'win32' ? 'http://gbframe.localhost' : 'gbframe://localhost';

type Params = {
  readonly stageId: string;
  readonly path: string;
  readonly hash?: string;
  readonly platform?: ProviderPlatform;
};

export const frameUrl = ({ stageId, path, hash, platform = currentPlatform() }: Params): string => {
  const fragment = hash === undefined || hash.length === 0 ? '' : `#${encodeURIComponent(hash)}`;
  return `${frameOrigin({ platform })}/${stageId}/${path}${fragment}`;
};
