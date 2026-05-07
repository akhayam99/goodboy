import type { PhaseTemplate, PhaseTemplateId, WorkspaceId } from '@kay-am/types';
import {
  listPhaseTemplates as dbList,
  getPhaseTemplate as dbGet,
  upsertPhaseTemplate as dbUpsert,
  deletePhaseTemplate as dbDelete,
  type Database,
} from '@kay-am/db';

export class PhaseRegistryError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'PhaseRegistryError';
  }
}

export interface PhaseRegistryDeps {
  readonly db: Database;
}

export class PhaseRegistry {
  constructor(private readonly deps: PhaseRegistryDeps) {}

  list(workspaceId: WorkspaceId): Promise<ReadonlyArray<PhaseTemplate>> {
    return dbList(this.deps.db, workspaceId);
  }

  get(id: PhaseTemplateId): Promise<PhaseTemplate | null> {
    return dbGet(this.deps.db, id);
  }

  async upsert(template: PhaseTemplate): Promise<PhaseTemplate> {
    this.validate(template);
    await dbUpsert(this.deps.db, template);
    return template;
  }

  delete(id: PhaseTemplateId): Promise<void> {
    return dbDelete(this.deps.db, id);
  }

  private validate(template: PhaseTemplate): void {
    if (template.name.trim().length === 0) throw new PhaseRegistryError('template name required');
    const defs = template.definitions;
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]!;
      if (def.ordinal !== i)
        throw new PhaseRegistryError(
          `ordinals must be contiguous starting at 0; got ${def.ordinal} at index ${i}`,
        );
      if (def.name.trim().length === 0)
        throw new PhaseRegistryError(`definition at ordinal ${i} has empty name`);
    }
    const names = new Set<string>();
    for (const d of defs) {
      if (names.has(d.name))
        throw new PhaseRegistryError(`duplicate definition name within template: ${d.name}`);
      names.add(d.name);
    }
  }
}
