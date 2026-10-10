import { expect } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import type { AgentId, ArtifactComment, ArtifactId, ProviderRunId } from '@goodboy/types';
import { openPlanDrawer } from '../../../features/plans/openPlanDrawer';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { STORY_NOW } from '../../../store/storyHarness';
import { aPlan, aStoredPlan } from '../../../test/planFixtures';
import { type Ctx, type Row, WAIT, click, settle, useAppStore, visible } from './harness';

const PLAN_ID = 'journey-plan-revising-plan' as ArtifactId;
const PLANNER_ID = 'journey-plan-revising-planner' as AgentId;
const REVISION_RUN = 'journey-plan-revising-run-2' as ProviderRunId;

const GOAL = 'Retried webhooks must never post a second credit.';

const REVISING_REASON = 'The planner is revising this plan';

const draftOf = ({ sessionId }: Ctx): ArtifactComment => ({
  id: 'journey-plan-revising-comment',
  sessionId,
  artifactId: PLAN_ID,
  revision: 1,
  anchor: { kind: 'block', order: 0, text: GOAL },
  body: 'Say what the retry delay is.',
  status: 'draft',
  sentTurnId: null,
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
});

const seedPlanWithDraft = (ctx: Ctx): void => {
  const { sessionId } = ctx;
  const plan = aPlan({ id: PLAN_ID, sessionId, agentId: PLANNER_ID, bodyMd: `## Goal\n${GOAL}` });
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: [
        ...(state.sessionPhaseRuns[sessionId] ?? []),
        {
          id: PLANNER_ID,
          sessionId,
          ordinal: 100,
          name: 'Plan',
          kind: 'planner',
          status: 'completed',
        },
      ],
    },
    sessionPlans: { ...state.sessionPlans, [sessionId]: [plan] },
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [sessionId]: [aStoredPlan({ sessionId, agentId: PLANNER_ID, revision: 1 }, plan)],
    },
    artifactComments: { ...state.artifactComments, [sessionId]: [draftOf(ctx)] },
    loadArtifactComments: async () => undefined,
    sendArtifactComments: async () => {
      useAppStore.setState((current) => ({
        artifactComments: {
          ...current.artifactComments,
          [sessionId]: (current.artifactComments[sessionId] ?? []).map((comment) => ({
            ...comment,
            status: 'sent' as const,
          })),
        },
        agentTurnState: {
          ...current.agentTurnState,
          [PLANNER_ID]: { kind: 'running', runId: REVISION_RUN, startedAt: STORY_NOW },
        },
      }));
      return new Promise<never>(() => undefined);
    },
  }));
};

const openArtifactsPage = ({ sessionId }: Ctx): void => {
  act(() =>
    useAppStore.getState().navigate({
      to: sessionPlace({
        sessionId,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: PLAN_ID },
      }),
    }),
  );
};

const sendToPlanner = async (): Promise<void> => {
  await screen.findByTestId('plan-comment-bar', undefined, WAIT);
  await click(await screen.findByRole('button', { name: 'Send to planner' }, WAIT));
};

const expectRevisingOnPage = async ({ sessionId }: Ctx): Promise<void> => {
  await waitFor(
    () => expect(useAppStore.getState().activeLens[sessionId] ?? null).toBe('plans'),
    WAIT,
  );
  await waitFor(
    () =>
      expect(
        screen.getAllByTestId('artifact-state-chip').map((chip) => chip.textContent ?? ''),
      ).toContain('Revising to v2'),
    WAIT,
  );
  const run = screen.getByRole('button', { name: 'Run plan' });
  expect(run.hasAttribute('disabled')).toBe(true);
  expect(run.getAttribute('title')).toBe(REVISING_REASON);
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const sendOnTheArtifactsPage = async (ctx: Ctx): Promise<void> => {
  seedPlanWithDraft(ctx);
  openArtifactsPage(ctx);
  await settle();
  await sendToPlanner();
  await settle(6);
};

const sendInTheDrawerThenOpenTheArtifactsPage = async (ctx: Ctx): Promise<void> => {
  seedPlanWithDraft(ctx);
  act(() => openPlanDrawer({ sessionId: ctx.sessionId, planId: PLAN_ID }));
  await settle();
  await visible('button', 'Open in Artifacts');
  await sendToPlanner();
  await waitFor(
    () =>
      expect(
        screen.getAllByTestId('artifact-state-chip').map((chip) => chip.textContent ?? ''),
      ).toContain('Revising to v2'),
    WAIT,
  );
  await click(await screen.findByRole('button', { name: 'Open in Artifacts' }, WAIT));
  await settle(6);
};

export const PLAN_REVISING_ROWS: ReadonlyArray<Row> = [
  {
    name: 'artifacts page: Send to planner starts the revision, the plan reads Revising to v2 and Run plan stays off',
    covers: ['navigate'],
    open: sendOnTheArtifactsPage,
    lands: expectRevisingOnPage,
  },
  {
    name: 'plan drawer: Open in Artifacts on a plan the planner is revising lands on the page with Run plan off',
    covers: ['navigate', 'openDrawer'],
    open: sendInTheDrawerThenOpenTheArtifactsPage,
    lands: expectRevisingOnPage,
  },
];
