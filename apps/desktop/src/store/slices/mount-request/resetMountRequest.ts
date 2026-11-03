import type { MountId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { MountRequestState } from './state';

type Params = {
  readonly state: Pick<AppState, 'mountRequests'>;
  readonly mountId: MountId;
  readonly branch: string;
};

type ResetParams = {
  readonly request: MountRequestState;
  readonly branch: string;
};

const resetOf = ({ request, branch }: ResetParams): MountRequestState => {
  if (request.kind === 'gitlab') {
    return { ...request, branch, mr: null, fetchedAt: null };
  }
  return { ...request, branch, pr: null, selected: null, fetchedAt: null };
};

export const resetMountRequest = ({
  state,
  mountId,
  branch,
}: Params): AppState['mountRequests'] => {
  const request = state.mountRequests?.[mountId];
  if (request === undefined) {
    return state.mountRequests ?? {};
  }
  return { ...state.mountRequests, [mountId]: resetOf({ request, branch }) };
};
