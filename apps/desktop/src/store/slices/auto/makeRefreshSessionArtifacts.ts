import type { GetFn, SetFn } from '../../slice-types';
import type { RefreshSessionArtifactsParams } from './ports';
import { reloadSessionArtifacts } from './reloadSessionArtifacts';

type Params = {
  readonly get: GetFn;
  readonly set: SetFn;
  readonly announce: (params: RefreshSessionArtifactsParams) => Promise<void>;
};

export const makeRefreshSessionArtifacts = ({ get, set, announce }: Params) => {
  return async ({ sessionId }: RefreshSessionArtifactsParams): Promise<void> => {
    const announced = announce({ sessionId }).then(
      () => null,
      (error: unknown) => error,
    );
    await reloadSessionArtifacts({ get, set, sessionId });
    const failure = await announced;
    if (failure !== null) {
      await get().reportError({
        title: "Couldn't tell the other windows about the plans",
        error: failure,
        sessionId,
      });
    }
  };
};
