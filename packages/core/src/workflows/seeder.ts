import type {
  AgentRole,
  IsoDateTime,
  Step,
  StepDefId,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { upsertWorkflow, type Database } from '@goodboy/db';
import { WORKFLOW_LIBRARY } from './library';
import { defaultsForRole } from '../roles';

// Global library seed ids created by db migration m045. Each canonical role has
// one. Seeded preset steps point back to these so the preset composer + library
// manager treat seeded steps as instances of the shared definitions.
const SEEDED_ROLES = new Set<AgentRole>([
  'scout',
  'planner',
  'implementer',
  'reviewer',
  'investigator',
  'product',
  'architect',
  'tester',
  'explorer',
]);

function libraryStepIdForRole(role: string): StepDefId | undefined {
  return SEEDED_ROLES.has(role as AgentRole) ? (`seed_${role}` as StepDefId) : undefined;
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

export const seedWorkflowLibrary = async (
  deps: SeedWorkflowLibraryDeps,
  workspaceId: WorkspaceId,
): Promise<SeedResult> => {
  const now = (deps.now ?? isoNow)();
  const seeded: Array<{ slug: string; workflowId: WorkflowId }> = [];

  for (const entry of WORKFLOW_LIBRARY) {
    const workflowId = makeWorkflowId(entry.slug, workspaceId);
    const steps: ReadonlyArray<Step> = entry.steps.map((s, ordinal) => {
      // Apply per-role defaults so the orchestrator routes each agent to a
      // sensibly-priced model out of the box. The user can still override at
      // the Step level later.
      const roleDefaults = defaultsForRole(s.role);
      const libraryStepId = libraryStepIdForRole(s.role);
      return {
        id: makeStepId(entry.slug, s.name, workspaceId),
        workflowId,
        ...(libraryStepId && { libraryStepId }),
        role: s.role as AgentRole,
        ordinal,
        name: s.name,
        promptPrefix: s.promptPrefix,
        providerOverride: roleDefaults.provider,
        modelOverride: roleDefaults.model,
      };
    });

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
};
