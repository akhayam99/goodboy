import type { MountId } from '@goodboy/types';

type Params = {
  readonly mountId: MountId;
};

export const depsInstallScriptId = ({ mountId }: Params): string => `deps-install:${mountId}`;
