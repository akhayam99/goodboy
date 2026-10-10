import { mockIPC } from '@tauri-apps/api/mocks';
import { LINEAR_PICKER_ANSWERS } from './linearPickerAnswers';

type IpcHandler = Parameters<typeof mockIPC>[0];

const EMPTY_ANSWERS: Readonly<Record<string, () => unknown>> = {
  detect_editors: () => [],
  detect_browsers: () => [],
  db_select: () => [],
  db_execute: () => ({ rowsAffected: 0 }),
  budget_rule_list: () => [],
  workflow_list: () => [],
  workspaces_with_unread: () => [],
  ...LINEAR_PICKER_ANSWERS,
};

export const mockSceneIpc = (handler: IpcHandler): void => {
  mockIPC((cmd, payload) => {
    const answer = handler(cmd, payload);
    if (answer === null || answer === undefined) {
      return EMPTY_ANSWERS[cmd]?.() ?? answer;
    }
    return answer;
  });
};
