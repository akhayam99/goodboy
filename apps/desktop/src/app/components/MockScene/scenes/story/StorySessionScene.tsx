import { useEffect, useState } from 'react';
import { OnboardingWizard } from '../../../../../features/onboarding/OnboardingWizard';
import {
  OPEN_WIZARD_EVENT,
  type OpenWizardDetail,
} from '../../../../../features/onboarding/onboardingSettings';
import { NewSessionBridge } from '../../../../../features/session/components/NewSessionBridge';
import { AppFrame } from '../audit/AppFrame';
import { installSceneDatabase } from '../sceneDatabase';
import { SETTLED_MOTION } from '../onboarding/wizardSceneSeed';
import { useAppStore } from '../../../../../store';
import { applyStoryAnswer } from '../../demo/director/applyStoryAnswer';
import { storyIssuesOf } from './storyIssues';
import { seedStoryWorld, type StoryStage } from './storyWorld';

type SceneStage = StoryStage | 'planned';

type Props = {
  readonly stage: SceneStage;
};

const WIZARD_OPEN_MS = 100;

export const StorySessionScene = ({ stage }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const isWizardUp = useAppStore((state) => state.openSessionDraftWorkspaceId === null);

  useEffect(() => {
    installSceneDatabase({
      fallback: ({ command }) =>
        command === 'linear_fetch_assigned_issues' ? storyIssuesOf() : undefined,
    });
    seedStoryWorld({ stage: stage === 'planned' ? 'asking' : stage });
    if (stage === 'planned') {
      applyStoryAnswer();
    }
    setIsReady(true);
  }, [stage]);

  useEffect(() => {
    if (!isReady || stage !== 'draft') {
      return;
    }
    const detail: OpenWizardDetail = { mode: 'full', step: 'first-session' };
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail }));
    }, WIZARD_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, stage]);

  if (!isReady) {
    return null;
  }
  return (
    <>
      <style>{SETTLED_MOTION}</style>
      <NewSessionBridge />
      <div className="contents" inert={stage === 'draft' && isWizardUp}>
        <AppFrame view="session" isRailCollapsed={false} hasPane hasDraft />
      </div>
      {stage === 'draft' ? <OnboardingWizard /> : null}
    </>
  );
};
