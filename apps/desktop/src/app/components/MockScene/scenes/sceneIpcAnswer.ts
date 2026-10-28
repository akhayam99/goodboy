import type { mockIPC } from '@tauri-apps/api/mocks';
import { LINEAR_PICKER_ANSWERS } from './linearPickerAnswers';

export type IpcHandler = Parameters<typeof mockIPC>[0];

const EMPTY_ANSWERS: Readonly<Record<string, () => unknown>> = {
  detect_editors: () => [],
  detect_browsers: () => [],
  db_select: () => [],
  db_execute: () => ({ rowsAffected: 0 }),
  budget_rule_list: () => [],
  workflow_list: () => [],
  workspaces_with_unread: () => [],
  worktree_carry_candidates: () => [],
  worktree_setup_proposal: () => null,
  worktree_deps_check: () => ({
    state: 'not-applicable',
    command: null,
    source: null,
    folder: null,
    isFolderLink: false,
    outside: [],
  }),
  file_versions_folder_size: () => ({
    folderPath: '/mock/Documents/acme-notes',
    isReady: true,
    fileCount: 86,
    keptBytes: 42 * 1024 * 1024,
    versionBytes: 18 * 1024 * 1024,
    versionCount: 12,
    capBytes: 1024 * 1024 * 1024,
  }),
  ...LINEAR_PICKER_ANSWERS,
};

type Params = {
  readonly handler: IpcHandler;
};

export const sceneIpcAnswer =
  ({ handler }: Params): IpcHandler =>
  (cmd, payload) => {
    const answer = handler(cmd, payload);
    if (answer === null || answer === undefined) {
      return EMPTY_ANSWERS[cmd]?.() ?? answer;
    }
    return answer;
  };
