import { mockIPC } from '@tauri-apps/api/mocks';
import { sceneIpcAnswer, type IpcHandler } from './sceneIpcAnswer';

export const mockSceneIpc = (handler: IpcHandler): void => {
  mockIPC(sceneIpcAnswer({ handler }));
};
