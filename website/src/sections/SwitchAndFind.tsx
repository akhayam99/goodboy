import { Grid } from '../components/Grid';
import { FIND_SEARCH, SWITCH_BELL } from '../figures';

export const SwitchAndFind = () => (
  <Grid
    label="Switching and search"
    cells={[
      {
        figure: SWITCH_BELL,
        title: 'Switch between tasks',
        text: 'The bell and the activity bar keep your place, so you come back to the step you left.',
      },
      {
        figure: FIND_SEARCH,
        title: 'Search and navigation',
        text: 'Press ⌘K for any session, agent or pull request. ⌘F reads every message and plan.',
      },
    ]}
  />
);
