import { ActivityQuestionScene } from '../ActivityQuestionScene';
import { ActivityRunScene } from '../ActivityRunScene';
import { MountsScene } from '../MountsScene';
import { C05OverviewScene } from './c05OverviewScene';

export const U25_C05_OVERVIEW_SCENES = {
  'c05-overview-running': () => <ActivityQuestionScene />,
  'c05-overview-lanes': () => <ActivityRunScene />,
  'c05-overview-merged-next': () => <C05OverviewScene state="merged-next" />,
  'c05-overview-merged-group': () => <C05OverviewScene state="merged-group" />,
  'c05-overview-notices': () => <C05OverviewScene state="notices" />,
  'c05-overview-blank': () => <MountsScene variant="blank" />,
  'c05-overview-archived': () => <MountsScene variant="archived" />,
};
