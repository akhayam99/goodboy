import type { AgentStatus } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { StatePresentation } from '../../shared/utils/statePresentation';

export const AGENT_STATUS_PRESENTATION = {
  pending: {
    label: 'Pending',
    reason: 'queued, it has not started yet',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runPending,
  },
  running: {
    label: 'Running',
    reason: 'working right now',
    tone: 'info',
    icon: CONCEPT_ICONS.sessions,
  },
  completed: {
    label: 'Completed',
    reason: 'it ran and finished its work',
    tone: 'success',
    icon: CONCEPT_ICONS.runDone,
  },
  failed: {
    label: 'Failed',
    reason: 'the agent stopped with an error or stopped responding',
    tone: 'danger',
    icon: CONCEPT_ICONS.runFailed,
  },
  blocked: {
    label: 'Blocked',
    reason:
      'the agent stopped without finishing and without asking you anything, tell it what to do next',
    tone: 'warning',
    icon: CONCEPT_ICONS.runBlocked,
  },
  skipped: {
    label: 'Skipped',
    reason: 'nothing ran for this step',
    tone: 'neutral',
    icon: CONCEPT_ICONS.runCancelled,
  },
} satisfies Record<AgentStatus, StatePresentation>;

type Params = {
  readonly status: AgentStatus;
};

export const describeAgentStatus = ({ status }: Params): StatePresentation =>
  AGENT_STATUS_PRESENTATION[status];
