import type {
  AgentRole,
  IsoDateTime,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { restoreSeededWorkflow, upsertWorkflow, type Database } from '@goodboy/db';
import { normalizeAgentRole } from '../roles';
import { builtinStepForRole } from './builtinSteps';
import { WORKFLOW_LIBRARY, type WorkflowLibraryEntry } from './library';

export type SeedWorkflowLibraryDeps = {
  readonly db: Database;
  readonly now?: () => IsoDateTime;
};

export type SeedResult = {
  readonly seeded: ReadonlyArray<{ slug: string; workflowId: WorkflowId }>;
};

const isoNow = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

function makeWorkflowId(slug: string, workspaceId: WorkspaceId): WorkflowId {
  return `wf_seed_${slug}_${workspaceId}` as WorkflowId;
}

function makeStepId(slug: string, stepName: string, workspaceId: WorkspaceId): StepId {
  const stepSlug = stepName.toLowerCase().replace(/\s+/g, '_');
  return `step_seed_${slug}_${stepSlug}_${workspaceId}` as StepId;
}

type SeedParams = {
  readonly entry: WorkflowLibraryEntry;
  readonly workspaceId: WorkspaceId;
  readonly now: IsoDateTime;
};

const seededWorkflow = ({ entry, workspaceId, now }: SeedParams): Workflow => {
  const workflowId = makeWorkflowId(entry.slug, workspaceId);
  const steps: ReadonlyArray<Step> = entry.steps.map((s, ordinal) => {
    const libraryStepId = builtinStepForRole({ role: normalizeAgentRole({ role: s.role }) })?.id;
    return {
      id: makeStepId(entry.slug, s.name, workspaceId),
      workflowId,
      ...(libraryStepId && { libraryStepId }),
      role: s.role as AgentRole,
      ordinal,
      name: s.name,
      promptPrefix: s.promptPrefix,
      expectedOutput: s.expectedOutput,
    };
  });
  return {
    id: workflowId,
    workspaceId,
    name: entry.name,
    description: entry.description,
    ...(entry.goal && { goal: entry.goal }),
    steps,
    origin: 'library',
    createdAt: now,
    updatedAt: now,
  };
};

export const seedWorkflowLibrary = async (
  deps: SeedWorkflowLibraryDeps,
  workspaceId: WorkspaceId,
): Promise<SeedResult> => {
  const now = (deps.now ?? isoNow)();
  const seeded: Array<{ slug: string; workflowId: WorkflowId }> = [];

  for (const entry of WORKFLOW_LIBRARY) {
    const workflow = seededWorkflow({ entry, workspaceId, now });
    await upsertWorkflow(deps.db, workflow);
    seeded.push({ slug: entry.slug, workflowId: workflow.id });
  }

  return { seeded };
};

export type RestoreWorkflowLibraryParams = {
  readonly workspaceId: WorkspaceId;
  readonly slugs: ReadonlyArray<string>;
};

export const restoreWorkflowLibrary = async (
  deps: SeedWorkflowLibraryDeps,
  { workspaceId, slugs }: RestoreWorkflowLibraryParams,
): Promise<SeedResult> => {
  const now = (deps.now ?? isoNow)();
  const wanted = new Set(slugs);
  const seeded: Array<{ slug: string; workflowId: WorkflowId }> = [];

  for (const entry of WORKFLOW_LIBRARY.filter((candidate) => wanted.has(candidate.slug))) {
    const workflow = seededWorkflow({ entry, workspaceId, now });
    await restoreSeededWorkflow(deps.db, workflow);
    seeded.push({ slug: entry.slug, workflowId: workflow.id });
  }

  return { seeded };
};
