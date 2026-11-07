import type { AgentStatus } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { NAMES } from '../../shared/utils/names';
import type { StatePresentation } from '../../shared/utils/statePresentation';

export const AGENT_STATUS_PRESENTATION = {
  pending: {
    label: NAMES.queued,
    reason: 'It has not started yet',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runPending,
  },
  running: {
    label: NAMES.running,
    reason: 'Running right now',
    tone: 'info',
    icon: CONCEPT_ICONS.stageRunning,
  },
  completed: {
    label: NAMES.done,
    reason: 'It ran and finished its work',
    tone: 'success',
    icon: CONCEPT_ICONS.runDone,
  },
  failed: {
    label: NAMES.failed,
    reason: 'It ended on an error. Open it to see why.',
    tone: 'danger',
    icon: CONCEPT_ICONS.runFailed,
  },
  blocked: {
    label: NAMES.needsYou,
    reason: 'It stopped before finishing. Tell it what to do next',
    tone: 'warning',
    icon: CONCEPT_ICONS.runBlocked,
  },
  skipped: {
    label: NAMES.skipped,
    reason: 'Nothing ran for this step',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runCancelled,
  },
  stopped: {
    label: NAMES.stopped,
    reason: 'What it wrote is kept',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runStopped,
  },
} satisfies Record<AgentStatus, StatePresentation>;

type Params = {
  readonly status: AgentStatus;
};

export const describeAgentStatus = ({ status }: Params): StatePresentation =>
  AGENT_STATUS_PRESENTATION[status];
