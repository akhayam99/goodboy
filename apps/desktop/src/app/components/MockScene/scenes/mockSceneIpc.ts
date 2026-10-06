import { mockIPC } from '@tauri-apps/api/mocks';

type IpcHandler = Parameters<typeof mockIPC>[0];

const LIST_COMMANDS: ReadonlySet<string> = new Set(['detect_editors', 'detect_browsers']);

export const mockSceneIpc = (handler: IpcHandler): void => {
  mockIPC((cmd, payload) => {
    const answer = handler(cmd, payload);
    if (answer === null || answer === undefined) {
      return LIST_COMMANDS.has(cmd) ? [] : answer;
    }
    return answer;
  });
};
