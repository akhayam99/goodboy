export type PollGate = 'always' | 'visible' | 'focused';

type StartPollParams = {
  readonly run: () => void;
  readonly everyMs: number;
  readonly gate: PollGate;
  readonly isImmediate: boolean;
};

type OpenParams = {
  readonly gate: PollGate;
};

const isOpen = ({ gate }: OpenParams): boolean => {
  if (gate === 'always') {
    return true;
  }
  if (document.visibilityState !== 'visible') {
    return false;
  }
  return gate === 'visible' || document.hasFocus();
};

export const startPoll = ({ run, everyMs, gate, isImmediate }: StartPollParams): (() => void) => {
  const tick = (): void => {
    if (isOpen({ gate })) {
      run();
    }
  };
  if (isImmediate) {
    tick();
  }
  const timer = setInterval(tick, everyMs);
  if (gate === 'always') {
    return () => clearInterval(timer);
  }
  document.addEventListener('visibilitychange', tick);
  if (gate === 'focused') {
    window.addEventListener('focus', tick);
  }
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', tick);
    window.removeEventListener('focus', tick);
  };
};
