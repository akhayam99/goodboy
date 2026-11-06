import type { WindowCloseGuard } from './decideWindowClose';

const ALLOW_CLOSE: WindowCloseGuard = async () => 'close';

const closeGuard: { current: WindowCloseGuard } = { current: ALLOW_CLOSE };

type GuardParams = Readonly<{
  guard: WindowCloseGuard;
}>;

export const setWindowCloseGuard = ({ guard }: GuardParams): (() => void) => {
  closeGuard.current = guard;
  return () => {
    if (closeGuard.current === guard) {
      closeGuard.current = ALLOW_CLOSE;
    }
  };
};

export const currentWindowCloseGuard = (): WindowCloseGuard => closeGuard.current;
