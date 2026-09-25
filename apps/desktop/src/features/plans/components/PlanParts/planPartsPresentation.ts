import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { StatePresentation } from '../../../../shared/utils/statePresentation';
import { planPartsSentence, type PlanPartsProgress } from './planPartRows';

export const planPartsPresentation = ({
  progress,
}: {
  readonly progress: PlanPartsProgress;
}): StatePresentation | null => {
  const label = planPartsSentence({ progress });
  switch (progress.kind) {
    case 'notRun':
      return null;
    case 'running':
      return {
        label,
        reason: 'a part of this plan is running',
        tone: 'info',
        icon: CONCEPT_ICONS.runPending,
      };
    case 'question':
      return {
        label,
        reason: 'a part waits on your answer',
        tone: 'warning',
        icon: CONCEPT_ICONS.questions,
      };
    case 'failed':
      return {
        label,
        reason: 'a part of this plan failed',
        tone: 'danger',
        icon: CONCEPT_ICONS.runFailed,
      };
    case 'waiting':
      return {
        label,
        reason: 'the remaining parts have not started',
        tone: 'neutral',
        icon: CONCEPT_ICONS.runPending,
      };
    case 'done':
      return { label, reason: 'every part finished', tone: 'success', icon: CONCEPT_ICONS.runDone };
    default: {
      const exhaustive: never = progress;
      return exhaustive;
    }
  }
};
