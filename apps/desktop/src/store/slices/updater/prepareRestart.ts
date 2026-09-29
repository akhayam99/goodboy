import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { relaunch } from '@tauri-apps/plugin-process';
import type { RestartReason } from '../turn/planRestartResume';
import { writeRestartReason } from '../turn/restartMarker';

type Params = {
  readonly reason: RestartReason;
};

export const relaunchWithResume = async ({ reason }: Params): Promise<void> => {
  await writeRestartReason({ reason }).catch(() => undefined);
  try {
    await invokeCommand<ReadonlyArray<string>>('restart_prepare');
  } catch (error) {
    await invokeCommand('restart_abort').catch(() => undefined);
    throw error;
  }
  try {
    await relaunch();
  } catch (error) {
    await invokeCommand('restart_abort').catch(() => undefined);
    throw error;
  }
};
