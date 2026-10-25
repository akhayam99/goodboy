export type PollGate = 'visible' | 'focused';

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
  const timer = window.setInterval(tick, everyMs);
  document.addEventListener('visibilitychange', tick);
  if (gate === 'focused') {
    window.addEventListener('focus', tick);
  }
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', tick);
    window.removeEventListener('focus', tick);
  };
};
