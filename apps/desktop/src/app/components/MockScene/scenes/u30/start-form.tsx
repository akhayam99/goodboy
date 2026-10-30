import type { ComponentType } from 'react';
import type { SessionDraft } from '../../../../../store/slices/sessionDraft/state';
import { START_PAGE_SEED } from '../u27/startPage/startPageSeedData';
import { StartFormScene } from './StartFormScene';

const NO_LABELS: ReadonlyArray<string> = [];

const OPEN_EDITS: ReadonlyArray<string> = ['Edits'];

const OPEN_LIMIT: ReadonlyArray<string> = ['Limit'];

const BASE = {
  workflowGoal: START_PAGE_SEED.goal,
  pickedIssues: [START_PAGE_SEED.task],
  projectIds: [START_PAGE_SEED.portalId],
} satisfies Partial<SessionDraft>;

const PRESET: Partial<SessionDraft> = {
  ...BASE,
  startKind: 'workflow',
  startShape: 'preset',
  workflowId: START_PAGE_SEED.presetId,
};

const ORCHESTRATED: Partial<SessionDraft> = {
  ...BASE,
  startKind: 'workflow',
  startShape: 'orchestrated',
};

const AUTO: Partial<SessionDraft> = {
  ...BASE,
  startKind: 'agent',
  startShape: 'autoAgent',
  workflowGoal: START_PAGE_SEED.autoAgentGoal,
};

const AGENT: Partial<SessionDraft> = {
  ...BASE,
  startKind: 'agent',
  startShape: 'agent',
  agentKind: 'scout',
  workflowGoal: START_PAGE_SEED.agentGoal,
};

const PICKING: Partial<SessionDraft> = {
  ...BASE,
  startKind: 'auto',
  startShape: null,
};

export const U30_START_FORM_SCENES = {
  'u30-start-form': () => <StartFormScene draft={PRESET} openLabels={NO_LABELS} />,
  'u30-start-form-orchestrated': () => (
    <StartFormScene draft={ORCHESTRATED} openLabels={NO_LABELS} />
  ),
  'u30-start-form-auto': () => <StartFormScene draft={AUTO} openLabels={NO_LABELS} />,
  'u30-start-form-agent': () => <StartFormScene draft={AGENT} openLabels={NO_LABELS} />,
  'u30-start-form-auto-picks': () => <StartFormScene draft={PICKING} openLabels={NO_LABELS} />,
  'u30-start-form-edits-open': () => <StartFormScene draft={PRESET} openLabels={OPEN_EDITS} />,
  'u30-start-form-limit-open': () => <StartFormScene draft={PRESET} openLabels={OPEN_LIMIT} />,
} satisfies Readonly<Record<string, ComponentType>>;
