import type { MountId } from '@goodboy/types';
import type { AppState } from '../../../store/types';

type Params = {
  readonly state: Pick<AppState, 'mountGithub'>;
  readonly mountId: MountId;
  readonly url: string;
};

export const checkNameOf = ({ state, mountId, url }: Params): string | null =>
  state.mountGithub[mountId]?.detail?.checks.find((check) => check.detailsUrl === url)?.name ??
  null;
