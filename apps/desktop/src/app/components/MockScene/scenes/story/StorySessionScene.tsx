import { useEffect, useState } from 'react';
import { NewSessionBridge } from '../../../../../features/session/components/NewSessionBridge';
import { AppFrame } from '../audit/AppFrame';
import { installSceneDatabase } from '../sceneDatabase';
import { SETTLED_MOTION } from '../onboarding/wizardSceneSeed';
import { applyStoryAnswer } from '../../demo/director/applyStoryAnswer';
import { storyIpcAnswer } from './storyIpc';
import { seedStoryWorld, type StoryStage } from './storyWorld';

type SceneStage = StoryStage | 'planned';

type Props = {
  readonly stage: SceneStage;
};

export const StorySessionScene = ({ stage }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase({ fallback: storyIpcAnswer });
    seedStoryWorld({ stage: stage === 'planned' ? 'asking' : stage });
    if (stage === 'planned') {
      applyStoryAnswer();
    }
    setIsReady(true);
  }, [stage]);

  if (!isReady) {
    return null;
  }
  return (
    <>
      <style>{SETTLED_MOTION}</style>
      <NewSessionBridge />
      <AppFrame view={stage === 'bring' ? 'connection-linear' : 'session'} hasPane hasDraft />
    </>
  );
};
