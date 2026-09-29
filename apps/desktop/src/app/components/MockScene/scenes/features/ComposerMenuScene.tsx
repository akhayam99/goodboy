import { BrandSlackScene } from '../brand/SlackScene';
import { useSceneClicks } from '../audit/useSceneClicks';

const LABELS: ReadonlyArray<string> = ['More actions'];

export const FeaturesComposerMenuScene = () => {
  useSceneClicks({
    isReady: true,
    labels: LABELS,
    selector: 'button',
    match: 'prefix',
    intervalMs: 400,
  });
  return <BrandSlackScene />;
};
