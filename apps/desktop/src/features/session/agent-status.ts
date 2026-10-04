import type { AgentStatus } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { StatePresentation } from '../../shared/utils/statePresentation';

export const AGENT_STATUS_PRESENTATION = {
  pending: {
    label: 'Pending',
    reason: "Queued, it hasn't started yet",
    tone: 'neutral',
    icon: CONCEPT_ICONS.runPending,
  },
  running: {
    label: 'Running',
    reason: 'Working right now',
    tone: 'info',
    icon: CONCEPT_ICONS.sessions,
  },
  completed: {
    label: 'Done',
    reason: 'It ran and finished its work',
    tone: 'success',
    icon: CONCEPT_ICONS.runDone,
  },
  failed: {
    label: 'Failed',
    reason: 'The agent stopped with an error or stopped responding',
    tone: 'danger',
    icon: CONCEPT_ICONS.runFailed,
  },
  blocked: {
    label: 'Blocked',
    reason:
      'The agent stopped without finishing and without asking you anything. Tell it what to do next',
    tone: 'warning',
    icon: CONCEPT_ICONS.runBlocked,
  },
  skipped: {
    label: 'Skipped',
    reason: 'Nothing ran for this step',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runCancelled,
  },
  stopped: {
    label: 'Stopped',
    reason: 'You stopped it, what it wrote is kept',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runStopped,
  },
} satisfies Record<AgentStatus, StatePresentation>;

type Params = {
  readonly status: AgentStatus;
};

export const describeAgentStatus = ({ status }: Params): StatePresentation =>
  AGENT_STATUS_PRESENTATION[status];
