import { invoke } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import type { RestartReason } from '../turn/planRestartResume';
import { writeRestartReason } from '../turn/restartMarker';

type Params = {
  readonly reason: RestartReason;
};

export const relaunchWithResume = async ({ reason }: Params): Promise<void> => {
  await writeRestartReason({ reason }).catch(() => undefined);
  try {
    await invoke<ReadonlyArray<string>>('restart_prepare');
  } catch (error) {
    await invoke('restart_abort').catch(() => undefined);
    throw error;
  }
  try {
    await relaunch();
  } catch (error) {
    await invoke('restart_abort').catch(() => undefined);
    throw error;
  }
};
