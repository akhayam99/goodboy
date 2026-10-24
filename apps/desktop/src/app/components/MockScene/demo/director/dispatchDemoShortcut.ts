import { currentPlatform } from '../../../../../shared/platform';
import type { DemoShortcutCode } from './demoProtocol';

type Params = {
  readonly code: DemoShortcutCode;
};

export const dispatchDemoShortcut = ({ code }: Params): void => {
  const isMac = currentPlatform() === 'darwin';
  window.focus();
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      code,
      key: code.slice(-1).toLowerCase(),
      metaKey: isMac,
      ctrlKey: !isMac,
      bubbles: true,
      cancelable: true,
    }),
  );
};
