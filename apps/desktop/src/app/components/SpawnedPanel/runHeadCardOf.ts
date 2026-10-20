import type { DotState, FactCardSpec, FactState } from '@goodboy/ui';

type Params = {
  readonly name: string;
  readonly dot: DotState;
  readonly word: string;
};

const DOT_FACT_TONE = {
  running: 'info',
  needsYou: 'warning',
  failed: 'danger',
  unread: 'info',
  done: 'ok',
  idle: 'neutral',
  stopped: 'neutral',
} as const satisfies Record<DotState, FactState['tone']>;

export const runHeadCardOf = ({ name, dot, word }: Params): FactCardSpec => ({
  title: name,
  state: { tone: DOT_FACT_TONE[dot], words: word, isRunning: dot === 'running' },
  facts: [],
});
