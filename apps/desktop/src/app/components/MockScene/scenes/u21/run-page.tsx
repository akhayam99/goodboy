import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { WorkflowsPane } from '../../../../../features/session/components/SessionWorkspace/parts/WorkflowsPane';
import { openPlanDrawer } from '../../../../../features/plans/openPlanDrawer';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { FLOW_SESSION, FLOW_SESSION_ID, NOW, SESSIONS } from '../flow-audit/fixtures';
import {
  PLAN_HOLD_DYNAMIC_SESSION,
  PLAN_HOLD_PLAN,
  seedWorkflowRunPlanHoldDynamic,
  seedWorkflowRunPlanQuestion,
} from '../flow-audit/planHoldRun';
import { seedWorkflowRun } from '../flow-audit/seeds';
import { installSceneDatabase } from '../sceneDatabase';
import { installScenePlanEngine } from '../scenePlanEngine';
import { seedRecentBackfillOutput } from '../flow-audit/runControl';

const SCROLLED_PX = 40;
const SCROLL_DELAY_MS = 300;

const seedLiveRun = (): void => {
  seedWorkflowRun();
  seedRecentBackfillOutput();
};

const seedPlanReview = (): void => {
  seedWorkflowRunPlanHoldDynamic();
  useAppStore.setState({ selectedAgentId: {} });
  installSceneDatabase();
  installScenePlanEngine({ sessionId: FLOW_SESSION_ID });
};

const seedPlanQuestion = (): void => {
  seedWorkflowRunPlanQuestion();
  useAppStore.setState({ selectedAgentId: {} });
  installSceneDatabase();
  installScenePlanEngine({ sessionId: FLOW_SESSION_ID });
};

const scrollerOf = (): HTMLElement | null => {
  const edge = document.querySelector('[data-slot="scroll-edge"]');
  const scroller = edge?.previousElementSibling ?? null;
  return scroller instanceof HTMLElement ? scroller : null;
};

const scrollSteps = (): (() => void) => {
  const timer = window.setTimeout(() => {
    const scroller = scrollerOf();
    if (scroller === null) {
      return;
    }
    scroller.scrollTop = SCROLLED_PX;
    scroller.dispatchEvent(new Event('scroll'));
  }, SCROLL_DELAY_MS);
  return () => window.clearTimeout(timer);
};

type SceneProps = {
  readonly session: Session;
  readonly seed: () => void;
  readonly afterMount?: () => (() => void) | void;
};

const RunPageScene = ({ session, seed, afterMount }: SceneProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seed();
    seedShellChrome({
      session,
      siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION_ID),
      branches: {},
      telemetryAt: NOW,
      lens: 'workflows',
    });
    useAppStore.setState({ currentWorkspaceId: session.workspaceId });
    setIsReady(true);
  }, [seed, session]);

  useEffect(() => {
    if (!isReady || afterMount === undefined) {
      return;
    }
    const cleanup = afterMount();
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [afterMount, isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={session}
      main={
        <div className="flex h-full min-h-0 flex-col">
          <WorkflowsPane session={session} />
        </div>
      }
    />
  );
};

const openHeldPlan = (): void => {
  openPlanDrawer({ sessionId: FLOW_SESSION_ID, planId: PLAN_HOLD_PLAN.id });
};

export const U21_RUN_PAGE_SCENES = {
  'workflow-run-scrolled': () => (
    <RunPageScene session={FLOW_SESSION} seed={seedLiveRun} afterMount={scrollSteps} />
  ),
  'workflow-run-plan-review': () => (
    <RunPageScene
      session={PLAN_HOLD_DYNAMIC_SESSION}
      seed={seedPlanReview}
      afterMount={openHeldPlan}
    />
  ),
  'workflow-run-plan-question': () => (
    <RunPageScene session={PLAN_HOLD_DYNAMIC_SESSION} seed={seedPlanQuestion} />
  ),
};
