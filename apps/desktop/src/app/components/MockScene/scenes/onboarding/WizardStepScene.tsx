import { useEffect, useState } from 'react';
import { WizardFrame } from '../../../../../features/onboarding/OnboardingWizard/WizardFrame';
import type { WizardStepId } from '../../../../../features/onboarding/OnboardingWizard/wizardSteps';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import {
  SETTLED_MOTION,
  seedWizardScene,
  type WizardSceneAgents,
  type WizardSceneWorkspace,
} from './wizardSceneSeed';

export type WizardSceneState =
  | 'welcome'
  | 'agents-ready'
  | 'agents-signin'
  | 'agents-none'
  | 'agents-error'
  | 'tools-github'
  | 'tools-linear'
  | 'tools-nogit'
  | 'first-ask'
  | 'first-task';

type Props = {
  readonly state: WizardSceneState;
  readonly theme: 'dark' | 'light';
};

type SceneSetup = {
  readonly step: WizardStepId;
  readonly agents: WizardSceneAgents;
  readonly ws: WizardSceneWorkspace;
  readonly hasLinear: boolean;
};

const SETUP: Readonly<Record<WizardSceneState, SceneSetup>> = {
  welcome: { step: 'welcome', agents: 'ready', ws: 'none', hasLinear: false },
  'agents-ready': { step: 'agents', agents: 'ready', ws: 'none', hasLinear: false },
  'agents-signin': { step: 'agents', agents: 'signin', ws: 'none', hasLinear: false },
  'agents-none': { step: 'agents', agents: 'none', ws: 'none', hasLinear: false },
  'agents-error': { step: 'agents', agents: 'error', ws: 'none', hasLinear: false },
  'tools-github': { step: 'tools', agents: 'ready', ws: 'repo', hasLinear: false },
  'tools-linear': { step: 'tools', agents: 'ready', ws: 'repo', hasLinear: false },
  'tools-nogit': { step: 'tools', agents: 'ready', ws: 'folder', hasLinear: false },
  'first-ask': { step: 'first-session', agents: 'ready', ws: 'repo', hasLinear: true },
  'first-task': { step: 'first-session', agents: 'ready', ws: 'repo', hasLinear: true },
};

type ClickParams = {
  readonly name: string;
};

const clickButton = ({ name }: ClickParams): void => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent === name,
  );
  button?.click();
};

const FOLLOW_UP: Partial<Readonly<Record<WizardSceneState, string>>> = {
  'tools-linear': 'Connect Linear',
  'agents-error': 'Output',
  'first-ask': 'Ask about the code',
  'first-task': 'Pick up an issue',
};

type Seeded = ReturnType<typeof seedWizardScene>;

export const WizardStepScene = ({ state, theme }: Props) => {
  const [seeded, setSeeded] = useState<Seeded | null>(null);
  const setup = SETUP[state];

  useEffect(() => {
    applyDocumentTheme({ theme });
    const { agents, ws, hasLinear } = SETUP[state];
    setSeeded(seedWizardScene({ agents, ws, hasLinear }));
  }, [state, theme]);

  useEffect(() => {
    const name = FOLLOW_UP[state];
    if (seeded === null || name === undefined) {
      return;
    }
    const timer = window.setTimeout(() => clickButton({ name }), 300);
    return () => window.clearTimeout(timer);
  }, [seeded, state]);

  if (seeded === null) {
    return null;
  }
  const { workspace, folders } = seeded;
  return (
    <>
      <style>{SETTLED_MOTION}</style>
      <WizardFrame
        mode="full"
        start={setup.step === 'welcome' ? null : setup.step}
        providersConnected={1}
        hasWorkspace={workspace !== null}
        workspace={workspace}
        workspaceId={workspace?.id ?? null}
        projectCount={folders.length}
        projects={folders}
        onClose={() => undefined}
      />
    </>
  );
};
