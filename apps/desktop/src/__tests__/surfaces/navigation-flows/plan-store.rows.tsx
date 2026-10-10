import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { AgentId, ArtifactId } from '@goodboy/types';
import { runObjectAction } from '../../../features/actions/registry';
import type { ActionEnv } from '../../../features/actions/types';
import { agentPlace } from '../../../store/slices/navigation/place';
import { aPlan, aStoredPlan } from '../../../test/planFixtures';
import { type Ctx, type Row, WAIT, settle, useAppStore, visible } from './harness';

const PLAN_ID = 'plan-navigation-retries' as ArtifactId;

const plannerOf = ({ sessionId }: Ctx): AgentId => {
  const agent = (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.workflowRunId == null && candidate.deletedAt == null,
  );
  if (agent === undefined) {
    throw new Error('the seeded session has no standalone agent to act as the planner');
  }
  return agent.id;
};

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: () => undefined,
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const openPlanFromTheActions = async (ctx: Ctx): Promise<void> => {
  const agentId = plannerOf(ctx);
  const plan = aPlan({ id: PLAN_ID, sessionId: ctx.sessionId, agentId });
  useAppStore.setState((state) => ({
    sessionPlans: { ...state.sessionPlans, [ctx.sessionId]: [plan] },
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [ctx.sessionId]: [aStoredPlan({ sessionId: ctx.sessionId, agentId }, plan)],
    },
  }));
  useAppStore.getState().navigate({ to: agentPlace({ sessionId: ctx.sessionId, agentId }) });
  await settle();
  await waitFor(
    () => expect(useAppStore.getState().selectedAgentId[ctx.sessionId]).toBe(agentId),
    WAIT,
  );
  await runObjectAction({
    target: {
      kind: 'artifact',
      sessionId: ctx.sessionId,
      subject: { kind: 'stored', artifactId: PLAN_ID, isPlanRunning: false },
    },
    actionId: 'artifact.open',
    env,
  });
  await settle();
};

const planDrawerOverTheAgentPage = async (ctx: Ctx): Promise<void> => {
  const agentId = plannerOf(ctx);
  await waitFor(
    () =>
      expect(useAppStore.getState().drawer).toMatchObject({
        kind: 'artifact-document',
        sessionId: ctx.sessionId,
        payload: { artifactId: PLAN_ID },
      }),
    WAIT,
  );
  await visible('button', 'Open in Artifacts');
  const state = useAppStore.getState();
  expect(state.currentSessionId).toBe(ctx.sessionId);
  expect(state.selectedAgentId[ctx.sessionId]).toBe(agentId);
  expect(state.activeLens[ctx.sessionId] ?? null).not.toBe('plans');
  expect(screen.queryByRole('heading', { name: 'Artifacts' })).toBeNull();
};

export const PLAN_STORE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'actions on a planner page: Open on its plan opens the plan drawer and stays on the agent page',
    covers: ['navigate', 'action:artifact.open'],
    open: openPlanFromTheActions,
    lands: planDrawerOverTheAgentPage,
  },
];
