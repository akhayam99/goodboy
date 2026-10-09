import { StartInboxScene } from './StartInboxScene';
import { StartPanelSlackScene } from './StartPanelSlackScene';
import { StartPasteScene } from './StartPasteScene';
import { StartPickedScene } from './StartPickedScene';

export const U23_START_SCENES = {
  'start-pick-one-block': StartPickedScene,
  'start-from-inbox': () => <StartInboxScene variant="issue" />,
  'start-review-row': () => <StartInboxScene variant="review" />,
  'start-paste-pr-url': StartPasteScene,
  'start-panel-slack': StartPanelSlackScene,
};
