import type { TailAction, TailActionId } from './tailFacts';

export const TAIL_ACTION = {
  stop: { id: 'stop', label: 'Stop' },
  stopAgent: { id: 'stopAgent', label: 'Stop agent' },
  stopAuto: { id: 'stopAuto', label: 'Stop Auto and its agents' },
  changeApproach: { id: 'changeApproach', label: 'Change approach' },
  stopStep: { id: 'stopStep', label: 'Stop step' },
  continue: { id: 'continue', label: 'Continue' },
  retry: { id: 'retry', label: 'Retry' },
  retryThroughAuto: { id: 'retryThroughAuto', label: 'Retry through Auto' },
  raiseLimit: { id: 'raiseLimit', label: 'Raise limit' },
  changeLimit: { id: 'changeLimit', label: 'Change limit' },
  answer: { id: 'answer', label: 'Answer' },
  viewTranscript: { id: 'viewTranscript', label: 'View transcript' },
  forceStop: { id: 'forceStop', label: 'Force stop' },
} as const satisfies Record<TailActionId, TailAction>;
