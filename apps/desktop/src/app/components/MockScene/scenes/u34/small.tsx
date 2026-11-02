import { PrPageScene } from '../u23/PrPageScene';
import { C09OrchestratedScene } from '../u25/C09OrchestratedScene';
import { RailProjectsScene } from '../u26/RailProjectsScene';
import { SmallDoneScene } from './SmallDoneScene';
import { StartFailureScene } from './StartFailureScene';

export const U34_SMALL_SCENES = {
  'u34-u35-unpushed': () => <PrPageScene variant="none" />,
  'u34-u5-question': SmallDoneScene,
  'u34-u33-branches': () => <RailProjectsScene opens="none" />,
  'u34-u56-step': () => <C09OrchestratedScene state="running" page="step" />,
  'u34-u12-provider': () => <StartFailureScene isProviderMissing />,
  'u34-u12-failure': () => <StartFailureScene isProviderMissing={false} />,
};
