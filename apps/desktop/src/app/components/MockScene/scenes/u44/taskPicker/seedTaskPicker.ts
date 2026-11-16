import { taskPickerSourcePref } from '../../../../../../features/session/components/SessionKickoff/TaskPickerPopover/taskPickerSourcePref';
import { useAppStore } from '../../../../../../store';
import { sceneClock } from '../../../sceneClock';
import { WORKSPACE_ID } from '../../BoardScene';
import { mockSceneIpc } from '../../mockSceneIpc';
import { seedStartPage } from '../../u27/startPage/seedStartPage';
import { workspaceTrackerBindings } from '../../workspaceInboxSeed';
import { TASK_PICKER_SEED } from './taskPickerSeedData';

export type TaskPickerSceneState = 'all' | 'sentry' | 'error' | 'loading';

type Params = {
  readonly state: TaskPickerSceneState;
};

type GhParams = {
  readonly args: unknown;
};

const NEVER = new Promise<never>(() => undefined);

const ANCHOR = '2026-11-16T10:30:00.000Z';

const CLOCK = sceneClock({ anchor: ANCHOR });

const ghAnswer = ({ args }: GhParams) => {
  const list = Array.isArray(args) ? args : [];
  if (list.includes('repo') && list.includes('view')) {
    return { stdout: TASK_PICKER_SEED.repo, stderr: '', exitCode: 0 };
  }
  if (list.includes('issue') && list.includes('list')) {
    return { stdout: JSON.stringify(TASK_PICKER_SEED.github), stderr: '', exitCode: 0 };
  }
  return { stdout: '[]', stderr: '', exitCode: 0 };
};

export const seedTaskPicker = ({ state }: Params): void => {
  seedStartPage({ draft: { hasChosenStart: true } });
  const isLoading = state === 'loading';
  mockSceneIpc((cmd, payload) => {
    if (cmd === 'linear_fetch_assigned_issues') {
      if (state === 'error') {
        return Promise.reject(new Error('Linear is unreachable'));
      }
      return isLoading ? NEVER : TASK_PICKER_SEED.linear;
    }
    if (cmd === 'sentry_fetch_issues') {
      return isLoading ? NEVER : { issues: TASK_PICKER_SEED.sentry, next_cursor: null };
    }
    if (cmd === 'gh_run') {
      const args: unknown = payload == null ? null : Reflect.get(payload, 'args');
      return isLoading ? NEVER : ghAnswer({ args });
    }
    return null;
  });
  const now = CLOCK.iso({ at: ANCHOR });
  useAppStore.setState({
    workspaceIntegrations: {
      [WORKSPACE_ID]: workspaceTrackerBindings({ workspaceId: WORKSPACE_ID, now }),
    },
  });
  taskPickerSourcePref({ workspaceId: WORKSPACE_ID }).write(state === 'sentry' ? 'sentry' : 'all');
};
