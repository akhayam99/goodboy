import type { DemoHint } from './demoHintTypes';

type Params = {
  readonly held: DemoHint | undefined;
  readonly acting: DemoHint | undefined;
  readonly active: DemoHint | undefined;
  readonly nextTitle: string;
};

export const headerInstruction = ({ held, acting, active, nextTitle }: Params): string => {
  if (held !== undefined) {
    return held.result;
  }
  if (active === undefined) {
    return `Done. Next: ${nextTitle}.`;
  }
  return acting?.progress ?? active.instruction;
};
