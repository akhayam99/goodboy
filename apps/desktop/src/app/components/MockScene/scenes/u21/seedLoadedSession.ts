import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly session: Session;
};

export const seedLoadedSession = ({ session }: Params): void => {
  const id = session.id;
  const base = useAppStore.getState();
  useAppStore.setState({
    sessionProjectMounts: {
      ...base.sessionProjectMounts,
      [id]: base.sessionProjectMounts[id] ?? [],
    },
    sessionWorktreeRecords: {
      ...base.sessionWorktreeRecords,
      [id]: base.sessionWorktreeRecords?.[id] ?? [],
    },
    sessionSlots: { ...base.sessionSlots, [id]: base.sessionSlots[id] ?? [] },
    sessionSlotsLoad: { ...base.sessionSlotsLoad, [id]: 'loaded' },
    sessionLoading: {
      ...base.sessionLoading,
      [id]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
    sessionPhaseRuns: { ...base.sessionPhaseRuns, [id]: base.sessionPhaseRuns[id] ?? [] },
    sessionPlans: { ...base.sessionPlans, [id]: base.sessionPlans[id] ?? [] },
    sessionEvents: { ...base.sessionEvents, [id]: base.sessionEvents[id] ?? [] },
    sessionArtifacts: { ...base.sessionArtifacts, [id]: base.sessionArtifacts[id] ?? [] },
    sessionOpenQuestions: {
      ...base.sessionOpenQuestions,
      [id]: base.sessionOpenQuestions[id] ?? [],
    },
    sessionAnsweredQuestions: {
      ...base.sessionAnsweredQuestions,
      [id]: base.sessionAnsweredQuestions[id] ?? [],
    },
    sessionDismissedQuestions: {
      ...base.sessionDismissedQuestions,
      [id]: base.sessionDismissedQuestions[id] ?? [],
    },
    sessionExternalTasks: {
      ...base.sessionExternalTasks,
      [id]: base.sessionExternalTasks[id] ?? [],
    },
    sessionWorkflows: { ...base.sessionWorkflows, [id]: base.sessionWorkflows[id] ?? [] },
  });
};
