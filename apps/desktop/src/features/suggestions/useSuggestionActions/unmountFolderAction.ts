import type { MountId, SessionId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import type { SuggestionActions } from '.';

type UnmountParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectName: string;
  readonly unmountMount: (params: UnmountParams) => Promise<unknown>;
};

export const unmountFolderAction = ({
  sessionId,
  mountId,
  projectName,
  unmountMount,
}: Params): SuggestionActions['primary'] => ({
  label: NAMES.unmount,
  isDisabled: false,
  requiresConfirm: true,
  failureTitle: `Couldn't unmount ${projectName}`,
  run: async () => {
    await unmountMount({ sessionId, mountId });
  },
});
