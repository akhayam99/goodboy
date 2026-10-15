import type { AutoPhase } from '@goodboy/db';

const TERMINAL_PHASES: ReadonlySet<AutoPhase> = new Set<AutoPhase>(['done', 'stopped']);

type PhaseParams = {
  readonly phase: AutoPhase;
};

const isAutoTreeTerminal = ({ phase }: PhaseParams): boolean => TERMINAL_PHASES.has(phase);

export const isAutoTreeActive = ({ phase }: PhaseParams): boolean => !isAutoTreeTerminal({ phase });
