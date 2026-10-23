import {
  brandId,
  type ProjectId,
  type StepId,
  type Workflow,
  type WorkflowId,
} from '@goodboy/types';
import type { IssueCandidate } from '../../../../../../features/integrations/fetchIssueCandidates';
import { WORKSPACE_ID } from '../../BoardScene';
import { sceneClock } from '../../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-22T09:00:00.000Z' });

const PRESET_ID = brandId<WorkflowId>({ value: 'mock-start-page-preset-fix-a-layout' });

const STEPS = [
  { role: 'scout', name: 'Find every member page layout' },
  { role: 'implementer', name: 'Center the page wrapper' },
  { role: 'tester', name: 'Check each page at 390, 768 and 1440' },
] as const;

export const START_PAGE_SEED = {
  goal: 'Center the six member pages of harbor-portal on every width, and keep the 390px layout working.',
  agentGoal:
    'List every page in harbor-portal that uses the member layout, and say which ones set their own width.',
  autoAgentGoal: 'Find why the member pages drift left on wide screens, and fix it.',
  repo: 'harbor-portal',
  portalId: brandId<ProjectId>({ value: 'mock-start-page-project-harbor-portal' }),
  presetId: PRESET_ID,
  preset: {
    id: PRESET_ID,
    workspaceId: WORKSPACE_ID,
    name: 'Fix a layout',
    description: 'Find the layouts, center the wrapper, check three widths.',
    steps: STEPS.map((step, ordinal) => ({
      id: brandId<StepId>({ value: `mock-start-page-step-${ordinal}` }),
      workflowId: PRESET_ID,
      ordinal,
      name: step.name,
      role: step.role,
      effort: 'medium',
      promptPrefix: '',
      verbosity: 'normal',
    })),
    isPreset: true,
    origin: 'custom',
    createdAt: clock.iso({ at: '2026-10-12T09:00:00.000Z' }),
    updatedAt: clock.iso({ at: '2026-10-12T09:00:00.000Z' }),
  } satisfies Workflow,
  task: {
    provider: 'linear',
    externalId: 'hbr-142',
    identifier: 'HBR-142',
    title: 'Member pages drift left on wide screens',
    url: 'https://linear.app/harborline/issue/HBR-142',
    goal: 'Center the six member pages of harbor-portal on every width, and keep the 390px layout working.',
    body: 'On a 1440 screen the member pages sit to the left of the header.',
    branchSlug: 'member-pages-drift-left-on-wide-screens',
  } satisfies IssueCandidate,
} as const;
