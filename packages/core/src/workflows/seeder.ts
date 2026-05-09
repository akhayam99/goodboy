import type { IsoDateTime, Step, StepId, Workflow, WorkflowId, WorkspaceId } from '@kay-am/types';
import { upsertWorkflow, type Database } from '@kay-am/db';
import { WORKFLOW_LIBRARY } from './library';

export interface SeedWorkflowLibraryDeps {
  readonly db: Database;
  readonly now?: () => IsoDateTime;
}

export interface SeedResult {
  readonly seeded: ReadonlyArray<{ slug: string; workflowId: WorkflowId }>;
}

const isoNow = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

function makeWorkflowId(slug: string, workspaceId: WorkspaceId): WorkflowId {
  return `wf_seed_${slug}_${workspaceId}` as WorkflowId;
}

function makeStepId(slug: string, stepName: string, workspaceId: WorkspaceId): StepId {
  const stepSlug = stepName.toLowerCase().replace(/\s+/g, '_');
  return `step_seed_${slug}_${stepSlug}_${workspaceId}` as StepId;
}

export async function seedWorkflowLibrary(
  deps: SeedWorkflowLibraryDeps,
  workspaceId: WorkspaceId,
): Promise<SeedResult> {
  const now = (deps.now ?? isoNow)();
  const seeded: Array<{ slug: string; workflowId: WorkflowId }> = [];

  for (const entry of WORKFLOW_LIBRARY) {
    const workflowId = makeWorkflowId(entry.slug, workspaceId);
    const steps: ReadonlyArray<Step> = entry.steps.map((s, ordinal) => ({
      id: makeStepId(entry.slug, s.name, workspaceId),
      workflowId,
      ordinal,
      name: s.name,
      promptPrefix: s.promptPrefix,
    }));

    const workflow: Workflow = {
      id: workflowId,
      workspaceId,
      name: entry.name,
      description: entry.description,
      steps,
      createdAt: now,
      updatedAt: now,
    };

    await upsertWorkflow(deps.db, workflow);
    seeded.push({ slug: entry.slug, workflowId });
  }

  return { seeded };
}
