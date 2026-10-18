import type { IWindowsPty } from '@xterm/xterm';
import { invokeCommand } from '../../lib/invokeCommand';
import { currentPlatform } from '../../platform';

type PlatformAnswer = {
  readonly windowsBuild: number | null;
};

export const loadWindowsPty = async (): Promise<IWindowsPty | null> => {
  if (currentPlatform() !== 'win32') {
    return null;
  }
  try {
    const answer = await invokeCommand<PlatformAnswer>('app_platform');
    if (answer.windowsBuild === null) {
      return null;
    }
    return { backend: 'conpty', buildNumber: answer.windowsBuild };
  } catch {
    return null;
  }
};
