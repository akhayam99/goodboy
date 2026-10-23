import type { ComponentType } from 'react';
import { StartPageScene } from './startPage/StartPageScene';
import { START_PAGE_SEED } from './startPage/startPageSeedData';

export const U27_START_PAGE_SCENES = {
  'u27-start-page-before-0-27-10': () => <StartPageScene era={{ kind: 'before-0-27-10' }} />,
  'u27-start-page-before-0-27-11': () => <StartPageScene era={{ kind: 'before-0-27-11' }} />,
  'u27-start-page-after-choice': () => (
    <StartPageScene era={{ kind: 'after', draft: { hasChosenStart: false } }} />
  ),
  'u27-start-page-after-workflow': () => (
    <StartPageScene era={{ kind: 'after', draft: { startKind: 'workflow' } }} />
  ),
  'u27-start-page-after-agent': () => (
    <StartPageScene era={{ kind: 'after', draft: { startKind: 'agent' } }} />
  ),
  'u27-start-page-after-orchestrated-form': () => (
    <StartPageScene
      era={{
        kind: 'after',
        draft: {
          startKind: 'workflow',
          startShape: 'orchestrated',
          workflowGoal: START_PAGE_SEED.goal,
        },
      }}
    />
  ),
  'u27-start-page-after-preset-form': () => (
    <StartPageScene
      era={{
        kind: 'after',
        draft: {
          startKind: 'workflow',
          startShape: 'preset',
          workflowGoal: START_PAGE_SEED.goal,
          workflowId: START_PAGE_SEED.presetId,
          pickedIssues: [START_PAGE_SEED.task],
          projectIds: [START_PAGE_SEED.portalId],
        },
      }}
    />
  ),
  'u27-start-page-after-agent-form': () => (
    <StartPageScene
      era={{
        kind: 'after',
        draft: {
          startKind: 'agent',
          startShape: 'agent',
          agentKind: 'scout',
          workflowGoal: START_PAGE_SEED.agentGoal,
        },
      }}
    />
  ),
  'u27-start-page-after-auto-agent-form': () => (
    <StartPageScene
      era={{
        kind: 'after',
        draft: {
          startKind: 'agent',
          startShape: 'autoAgent',
          workflowGoal: START_PAGE_SEED.autoAgentGoal,
        },
      }}
    />
  ),
  'u27-start-page-after-auto-picks': () => (
    <StartPageScene
      era={{ kind: 'after', draft: { startKind: 'auto', workflowGoal: START_PAGE_SEED.goal } }}
    />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
