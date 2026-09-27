import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { SessionSetupStep } from '../../../../../store/slices/sessionStart/state';
import { sessionSetupSteps, type SetupStepView } from '../sessionSetupSteps';

type Params = {
  readonly session: Session;
};

type Result = {
  readonly isActive: boolean;
  readonly steps: ReadonlyArray<SetupStepView>;
};

const NOT_LOADED = -1;

export const useSessionSetup = ({ session }: Params): Result => {
  const sessionId = session.id;
  const agentCount = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId]?.length ?? NOT_LOADED,
  );
  const hasGoal = useAppStore((state) =>
    (state.sessionSlots[sessionId] ?? EMPTY_ARRAY).some(
      (slot) => slot.key === 'goal' && slot.value.trim() !== '',
    ),
  );
  const hasProject = useAppStore(
    (state) => (state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY).length > 0,
  );
  const skipped = useAppStore(
    (state) =>
      state.sessionSetupSkips[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionSetupStep>),
  );
  const focus = useAppStore((state) => state.sessionSetupOpenStep[sessionId] ?? null);

  const isActive =
    session.archivedAt == null && (session.workflowRuns ?? []).length === 0 && agentCount === 0;

  const steps = useMemo(() => {
    const done = new Set<SessionSetupStep>([
      ...(hasGoal ? (['goal'] as const) : []),
      ...(hasProject ? (['project'] as const) : []),
    ]);
    return sessionSetupSteps({ done, skipped, focus });
  }, [focus, hasGoal, hasProject, skipped]);

  return { isActive, steps };
};
