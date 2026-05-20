import type { Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import {
  listWorkflows as dbList,
  getWorkflow as dbGet,
  upsertWorkflow as dbUpsert,
  deleteWorkflow as dbDelete,
  type Database,
} from '@goodboy/db';

export class WorkflowRegistryError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'WorkflowRegistryError';
  }
}

export interface WorkflowRegistryDeps {
  readonly db: Database;
}

export class WorkflowRegistry {
  constructor(private readonly deps: WorkflowRegistryDeps) {}

  list(workspaceId: WorkspaceId): Promise<ReadonlyArray<Workflow>> {
    return dbList(this.deps.db, workspaceId);
  }

  get(id: WorkflowId): Promise<Workflow | null> {
    return dbGet(this.deps.db, id);
  }

  async upsert(template: Workflow): Promise<Workflow> {
    this.validate(template);
    await dbUpsert(this.deps.db, template);
    return template;
  }

  delete(id: WorkflowId): Promise<void> {
    return dbDelete(this.deps.db, id);
  }

  private validate(template: Workflow): void {
    if (template.name.trim().length === 0)
      throw new WorkflowRegistryError('template name required');
    const defs = template.steps;
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]!;
      if (def.ordinal !== i)
        throw new WorkflowRegistryError(
          `ordinals must be contiguous starting at 0; got ${def.ordinal} at index ${i}`,
        );
      if (def.name.trim().length === 0)
        throw new WorkflowRegistryError(`definition at ordinal ${i} has empty name`);
    }
    const names = new Set<string>();
    for (const d of defs) {
      if (names.has(d.name))
        throw new WorkflowRegistryError(`duplicate definition name within template: ${d.name}`);
      names.add(d.name);
    }
  }
}
