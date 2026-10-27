import type { ComponentType } from 'react';
import { StartPageScene } from './startPage/StartPageScene';
import { START_PAGE_SEED } from './startPage/startPageSeedData';

export const U27_START_PAGE_SCENES = {
  'u27-start-page-after-choice': () => <StartPageScene draft={{ hasChosenStart: false }} />,
  'u27-start-page-after-workflow': () => <StartPageScene draft={{ startKind: 'workflow' }} />,
  'u27-start-page-after-agent': () => <StartPageScene draft={{ startKind: 'agent' }} />,
  'u27-start-page-after-orchestrated-form': () => (
    <StartPageScene
      draft={{
        startKind: 'workflow',
        startShape: 'orchestrated',
        workflowGoal: START_PAGE_SEED.goal,
      }}
    />
  ),
  'u27-start-page-after-preset-form': () => (
    <StartPageScene
      draft={{
        startKind: 'workflow',
        startShape: 'preset',
        workflowGoal: START_PAGE_SEED.goal,
        workflowId: START_PAGE_SEED.presetId,
        pickedIssues: [START_PAGE_SEED.task],
        projectIds: [START_PAGE_SEED.portalId],
      }}
    />
  ),
  'u27-start-page-after-agent-form': () => (
    <StartPageScene
      draft={{
        startKind: 'agent',
        startShape: 'agent',
        agentKind: 'scout',
        workflowGoal: START_PAGE_SEED.agentGoal,
      }}
    />
  ),
  'u27-start-page-after-auto-agent-form': () => (
    <StartPageScene
      draft={{
        startKind: 'agent',
        startShape: 'autoAgent',
        workflowGoal: START_PAGE_SEED.autoAgentGoal,
      }}
    />
  ),
  'u27-start-page-after-auto-picks': () => (
    <StartPageScene draft={{ startKind: 'auto', workflowGoal: START_PAGE_SEED.goal }} />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
