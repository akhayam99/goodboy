import type { DemoHint } from './demoHintTypes';

type Params = {
  readonly held: DemoHint | undefined;
  readonly acting: DemoHint | undefined;
  readonly active: DemoHint | undefined;
  readonly nextTitle: string;
  readonly isRecovering: boolean;
};

export const headerInstruction = ({
  held,
  acting,
  active,
  nextTitle,
  isRecovering,
}: Params): string => {
  if (held !== undefined) {
    return held.result;
  }
  if (active === undefined) {
    return `Done. Next: ${nextTitle}.`;
  }
  if (isRecovering && active.recovery !== undefined) {
    return active.recovery.instruction;
  }
  return acting?.progress ?? active.instruction;
};
