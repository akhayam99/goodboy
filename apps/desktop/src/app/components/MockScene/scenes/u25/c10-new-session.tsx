import { StartPickedScene } from '../u23/StartPickedScene';
import { U24_NEW_DRAWER_SCENES } from '../u24/new-drawer';
import { C10NewMenuScene } from './C10NewMenuScene';
import { C10NewSessionScene, type C10SceneState } from './C10NewSessionScene';

const RUN_GOAL =
  'Make ledger posts in payments-api safe to retry end to end, and keep ledger-core balances unchanged';

const AGENT_GOAL =
  'Find out why webhook redeliveries post a second credit in payments-api and propose a fix';

const TWO_PROJECTS = ['payments-api', 'ledger-core'];

const WORKFLOW: C10SceneState = {
  page: { choice: 'workflow', isPreset: true, goal: RUN_GOAL },
  projectNames: TWO_PROJECTS,
};

const ORCHESTRATE: C10SceneState = {
  page: { choice: 'orchestrate', goal: RUN_GOAL },
  projectNames: TWO_PROJECTS,
};

const AGENT: C10SceneState = {
  page: { choice: 'scout', goal: AGENT_GOAL },
  projectNames: TWO_PROJECTS,
};

const AUTO: C10SceneState = {
  page: { choice: 'scout', isAuto: true, goal: AGENT_GOAL },
  projectNames: [],
};

const PICKER: C10SceneState = {
  page: { choice: 'orchestrate', goal: RUN_GOAL },
  projectNames: TWO_PROJECTS,
  hasManyProjects: true,
  isPickerOpen: true,
};

const FAILED: C10SceneState = {
  page: { choice: 'orchestrate', goal: RUN_GOAL },
  projectNames: TWO_PROJECTS,
  startFailure: 'The branch hl/retry-guard already exists in payments-api.',
  clickLabel: 'Start orchestration',
};

export const U25_C10_NEW_SESSION_SCENES = {
  'c10-start-task': StartPickedScene,
  'c10-start-workflow': () => <C10NewSessionScene state={WORKFLOW} />,
  'c10-start-orchestrate': () => <C10NewSessionScene state={ORCHESTRATE} />,
  'c10-start-agent': () => <C10NewSessionScene state={AGENT} />,
  'c10-start-auto': () => <C10NewSessionScene state={AUTO} />,
  'c10-start-projects': () => <C10NewSessionScene state={PICKER} />,
  'c10-start-failed': () => <C10NewSessionScene state={FAILED} />,
  'c10-new-menu': C10NewMenuScene,
  'c10-new-run': U24_NEW_DRAWER_SCENES['new-drawer-run-preset'],
  'c10-new-orchestrate': U24_NEW_DRAWER_SCENES['new-drawer-run'],
  'c10-new-agent': U24_NEW_DRAWER_SCENES['new-drawer-agent'],
  'c10-new-auto': U24_NEW_DRAWER_SCENES['new-drawer-agent-auto'],
  'c10-new-report': U24_NEW_DRAWER_SCENES['new-drawer-write'],
  'c10-new-wireframe': U24_NEW_DRAWER_SCENES['new-drawer-write-wireframe'],
};
