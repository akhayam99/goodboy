import { BrandSlackScene } from '../brand/SlackScene';
import { NAMES } from '../../../../../shared/utils/names';
import { useSceneClicks } from '../audit/useSceneClicks';

const LABELS: ReadonlyArray<string> = [NAMES.addToMessage];

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
