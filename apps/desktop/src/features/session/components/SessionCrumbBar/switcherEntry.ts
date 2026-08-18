import type { Agent } from '@goodboy/types';
import type { classifyAgent } from '../../agent-kind';

export type SwitcherEntry = {
  readonly agent: Agent;
  readonly kind: ReturnType<typeof classifyAgent>;
  readonly isFinished: boolean;
};
