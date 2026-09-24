import { WorkflowBuilderScene } from '../flow-audit/WorkflowBuilderScene';
import { sceneParam } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';

const MODES: ReadonlyArray<string> = (sceneParam({ key: 'click' }) ?? 'Custom').split(',');

export const WorkflowBuilderModesScene = () => {
  useSceneClicks({
    isReady: true,
    labels: MODES,
    selector: 'button, [role="tab"], [role="radio"]',
    match: 'prefix',
    intervalMs: 250,
  });
  return <WorkflowBuilderScene />;
};
