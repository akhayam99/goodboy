import { NewSessionPageScene } from './NewSessionPageScene';

const RUN_GOAL =
  'Make ledger posts in payments-api safe to retry end to end, and keep ledger-core balances unchanged';

const AGENT_GOAL =
  'Find out why webhook redeliveries post a second credit in payments-api and propose a fix';

export const U24_NEW_SESSION_PAGE_SCENES = {
  'new-session-page-run': () => (
    <NewSessionPageScene state={{ choice: 'workflow', goal: RUN_GOAL }} />
  ),
  'new-session-page-run-preset': () => (
    <NewSessionPageScene state={{ choice: 'workflow', isPreset: true, goal: RUN_GOAL }} />
  ),
  'new-session-page-agent': () => (
    <NewSessionPageScene state={{ choice: 'scout', goal: AGENT_GOAL }} />
  ),
  'new-session-page-agent-auto': () => (
    <NewSessionPageScene state={{ choice: 'scout', isAuto: true, goal: AGENT_GOAL }} />
  ),
};
