import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { lastStartKey, type LastStart } from './lastStartSetting';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly last: LastStart;
};

const REMEMBER_FAILED = "Couldn't remember how you started";

export const rememberLastStart = ({ workspaceId, last }: Params): void => {
  const { saveSetting, reportError } = useAppStore.getState();
  saveSetting(lastStartKey({ workspaceId }), last).catch((error: unknown) => {
    void reportError({ title: REMEMBER_FAILED, error, workspaceId });
  });
};
