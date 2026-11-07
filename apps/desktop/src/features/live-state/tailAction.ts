import { NAMES } from '../../shared/utils/names';
import type { TailAction, TailActionId } from './tailFacts';

export const TAIL_ACTION = {
  stop: { id: 'stop', label: NAMES.stop },
  stopAgent: { id: 'stopAgent', label: NAMES.stop },
  stopAuto: { id: 'stopAuto', label: NAMES.stop },
  stopStep: { id: 'stopStep', label: NAMES.stopStep },
  continue: { id: 'continue', label: NAMES.continue },
  retry: { id: 'retry', label: NAMES.retry },
  retryThroughAuto: { id: 'retryThroughAuto', label: NAMES.retry },
  raiseLimit: { id: 'raiseLimit', label: 'Raise limit' },
  changeLimit: { id: 'changeLimit', label: 'Change limit' },
  answer: { id: 'answer', label: 'Answer' },
  confirmDelegation: { id: 'confirmDelegation', label: 'Confirm' },
  declineDelegation: { id: 'declineDelegation', label: 'Decline' },
  viewTranscript: { id: 'viewTranscript', label: 'Open transcript' },
  forceStop: { id: 'forceStop', label: NAMES.forceStop },
} as const satisfies Record<TailActionId, TailAction>;
