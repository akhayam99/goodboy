import type {
  AgentRole,
  IsoDateTime,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import {
  readBuiltinSeedState,
  findActiveWorkflowRunTitle,
  listWorkflowsIncludingDeleted,
  restoreSeededWorkflow,
  takenNameKey,
  upsertWorkflow,
  type Database,
} from '@goodboy/db';
import { normalizeAgentRole } from '../roles';
import { builtinStepForRole } from './builtinSteps';
import { WORKFLOW_LIBRARY, type WorkflowLibraryEntry } from './library';
import { findBuiltinWorkflow } from './findBuiltinWorkflow';

export type WorkflowRestoreErrorKind = 'name_taken' | 'workflow_running';

type WorkflowRestoreErrorParams = {
  readonly kind: WorkflowRestoreErrorKind;
  readonly message: string;
};

export class WorkflowRestoreError extends Error {
  readonly kind: WorkflowRestoreErrorKind;

  constructor({ kind, message }: WorkflowRestoreErrorParams) {
    super(message);
    this.name = 'WorkflowRestoreError';
    this.kind = kind;
  }
}

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
  readonly existing?: Workflow;
};

const seededWorkflow = ({ entry, workspaceId, now, existing }: SeedParams): Workflow => {
  const workflowId = existing?.id ?? makeWorkflowId(entry.slug, workspaceId);
  const steps: ReadonlyArray<Step> = entry.steps.map((s, ordinal) => {
    const libraryStepId = builtinStepForRole({ role: normalizeAgentRole({ role: s.role }) })?.id;
    const existingStep = existing?.steps.find(
      (step) => step.ordinal === ordinal && step.name === s.name,
    );
    return {
      id: existingStep?.id ?? makeStepId(entry.slug, s.name, workspaceId),
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
    createdAt: existing?.createdAt ?? now,
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

export type SeedMissingResult = {
  readonly seeded: ReadonlyArray<{ workspaceId: WorkspaceId; workflowId: WorkflowId }>;
};

export const seedMissingBuiltinWorkflows = async (
  deps: SeedWorkflowLibraryDeps,
): Promise<SeedMissingResult> => {
  const now = (deps.now ?? isoNow)();
  const { workspaceIds, seededIds, takenNames } = await readBuiltinSeedState(deps.db);
  const seeded: Array<{ workspaceId: WorkspaceId; workflowId: WorkflowId }> = [];

  for (const workspaceId of workspaceIds) {
    for (const entry of WORKFLOW_LIBRARY) {
      const workflow = seededWorkflow({ entry, workspaceId, now });
      if (
        seededIds.has(workflow.id) ||
        takenNames.has(takenNameKey({ workspaceId, name: entry.name }))
      ) {
        continue;
      }
      const inserted = await upsertWorkflow(deps.db, workflow).then(
        () => true,
        () => false,
      );
      if (inserted) {
        seeded.push({ workspaceId, workflowId: workflow.id });
      }
    }
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
  const workflows = await listWorkflowsIncludingDeleted({ db: deps.db, workspaceId });

  for (const entry of WORKFLOW_LIBRARY.filter((candidate) => wanted.has(candidate.slug))) {
    const existing = findBuiltinWorkflow({ workflows, entry });
    const workflow = seededWorkflow({
      entry,
      workspaceId,
      now,
      ...(existing === null ? {} : { existing }),
    });
    if (existing !== null) {
      const sessionTitle = await findActiveWorkflowRunTitle({
        db: deps.db,
        workflowId: existing.id,
      });
      if (sessionTitle !== null) {
        const title = sessionTitle.trim() === '' ? 'Untitled session' : sessionTitle;
        throw new WorkflowRestoreError({
          kind: 'workflow_running',
          message: `${entry.name} is running in ${title}. Restore it when the run ends.`,
        });
      }
    }
    const outcome = await restoreSeededWorkflow({ db: deps.db, workflow });
    if (outcome === 'name_taken') {
      throw new WorkflowRestoreError({
        kind: 'name_taken',
        message: `A workflow named ${entry.name} already exists. Rename it and try again.`,
      });
    }
    if (outcome === 'workflow_running') {
      throw new WorkflowRestoreError({
        kind: 'workflow_running',
        message: `${entry.name} is running in another session. Restore it when the run ends.`,
      });
    }
    seeded.push({ slug: entry.slug, workflowId: workflow.id });
  }

  return { seeded };
};
