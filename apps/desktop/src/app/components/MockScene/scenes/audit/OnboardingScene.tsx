import { useEffect, useState } from 'react';
import { OnboardingWizard } from '../../../../../features/onboarding/OnboardingWizard';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { ShellFrame } from '../shellChrome';
import {
  WIZARD_STEPS,
  type WizardStepId,
} from '../../../../../features/onboarding/OnboardingWizard/wizardSteps';
import {
  OPEN_WIZARD_EVENT,
  type OpenWizardDetail,
} from '../../../../../features/onboarding/onboarding-store';
import {
  SETTLED_MOTION,
  WIZARD_SCENE_AGENTS,
  WIZARD_SCENE_WORKSPACES,
  seedWizardScene,
  type WizardSceneAgents,
  type WizardSceneWorkspace,
} from '../onboarding/wizardSceneSeed';
import { sampleScoutRuns } from '../onboarding/sampleScoutRuns';
import { connectDemoTool } from '../onboarding/connectDemoTool';
import { InstantToolConnectContext } from '../../../../../features/onboarding/OnboardingWizard/instantToolConnectContext';
import { isDirectedScene } from '../../demo/director/isDirectedScene';
import { sceneParam } from './sceneParams';

type PickParams<T extends string> = {
  readonly key: string;
  readonly options: ReadonlyArray<T>;
  readonly fallback: T;
};

const pickParam = <T extends string>({ key, options, fallback }: PickParams<T>): T => {
  const value = sceneParam({ key });
  return options.find((option) => option === value) ?? fallback;
};

const STEPS_BEFORE_A_WORKSPACE: ReadonlySet<WizardStepId> = new Set([
  'welcome',
  'agents',
  'workspace',
]);

type SceneSetup = {
  readonly step: WizardStepId;
  readonly agents: WizardSceneAgents;
  readonly ws: WizardSceneWorkspace;
};

const readSetup = (): SceneSetup => {
  const step = pickParam<WizardStepId>({ key: 'step', options: WIZARD_STEPS, fallback: 'welcome' });
  const agents = pickParam<WizardSceneAgents>({
    key: 'agents',
    options: WIZARD_SCENE_AGENTS,
    fallback: 'ready',
  });
  const ws = pickParam<WizardSceneWorkspace>({
    key: 'ws',
    options: WIZARD_SCENE_WORKSPACES,
    fallback: STEPS_BEFORE_A_WORKSPACE.has(step) ? 'none' : 'repo',
  });
  return { step, agents, ws };
};

const OPEN_DELAY_MS = 100;
const REOPEN_MS = 1200;

export const OnboardingScene = () => {
  const [setup] = useState(readSetup);
  const [isReady, setIsReady] = useState(false);
  const session = useAppStore((state) => sessionById(state.sessions, state.currentSessionId));

  useEffect(() => {
    const { step, agents, ws } = setup;
    seedWizardScene({ agents, ws, hasLinear: step === 'first-session' });
    setIsReady(true);
    return () => sampleScoutRuns.cancel();
  }, [setup]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const detail: OpenWizardDetail = { mode: 'full', step: setup.step };
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail }));
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, setup]);

  useEffect(() => {
    if (!isReady || !isDirectedScene()) {
      return;
    }
    const timer = window.setInterval(() => {
      const state = useAppStore.getState();
      const isWizardOpen = document.querySelector('[aria-label="Goodboy setup"]') !== null;
      if (isWizardOpen || state.currentSessionId !== null) {
        return;
      }
      const step: WizardStepId = state.workspaces.length > 0 ? 'first-session' : 'welcome';
      const detail: OpenWizardDetail = { mode: 'full', step };
      window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail }));
    }, REOPEN_MS);
    return () => window.clearInterval(timer);
  }, [isReady]);

  if (!isReady) {
    return null;
  }
  return (
    <main className="h-screen bg-background text-foreground">
      <style>{SETTLED_MOTION}</style>
      {session === undefined ? null : (
        <ShellFrame session={session} main={<ChatView session={session} />} />
      )}
      <InstantToolConnectContext.Provider value={connectDemoTool}>
        <OnboardingWizard />
      </InstantToolConnectContext.Provider>
    </main>
  );
};
