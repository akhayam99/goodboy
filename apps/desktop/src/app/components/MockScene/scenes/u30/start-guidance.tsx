import type { ComponentType } from 'react';
import type { SessionDraft } from '../../../../../store/slices/sessionDraft/state';
import { START_PAGE_SEED } from '../u27/startPage/startPageSeedData';
import { StartFormScene } from './StartFormScene';

const NO_LABELS: ReadonlyArray<string> = [];

const OPEN_GUIDANCE: ReadonlyArray<string> = ['Guidance'];

const WORKSPACE_GUIDANCE =
  'Keep every change inside payments-api. Ask before touching the ledger-core schema.';

const AUTO: Partial<SessionDraft> = {
  hasChosenStart: true,
  workflowGoal: START_PAGE_SEED.autoAgentGoal,
  pickedIssues: [START_PAGE_SEED.task],
  projectIds: [START_PAGE_SEED.portalId],
  startKind: 'agent',
  startShape: 'autoAgent',
};

export const U30_START_GUIDANCE_SCENES = {
  'u30-start-guidance': () => (
    <StartFormScene draft={AUTO} openLabels={NO_LABELS} guidance={WORKSPACE_GUIDANCE} />
  ),
  'u30-start-guidance-open': () => (
    <StartFormScene draft={AUTO} openLabels={OPEN_GUIDANCE} guidance={WORKSPACE_GUIDANCE} />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
