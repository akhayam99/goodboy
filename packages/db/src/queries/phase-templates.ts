import type {
  IsoDateTime,
  PhaseDefinition,
  PhaseDefinitionId,
  PhaseTemplate,
  PhaseTemplateId,
  ProviderId,
  WorkspaceId,
} from '@kay-am/types';
import type { Database } from '../client';

interface PhaseTemplateRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface PhaseDefinitionRow {
  id: string;
  template_id: string;
  ordinal: number;
  name: string;
  prompt_prefix: string;
  provider_override: string | null;
  model_override: string | null;
}

function toPhaseDefinition(row: PhaseDefinitionRow): PhaseDefinition {
  return {
    id: row.id as PhaseDefinitionId,
    templateId: row.template_id as PhaseTemplateId,
    ordinal: row.ordinal,
    name: row.name,
    promptPrefix: row.prompt_prefix,
    ...(row.provider_override && { providerOverride: row.provider_override as ProviderId }),
    ...(row.model_override && { modelOverride: row.model_override }),
  };
}

function toPhaseTemplate(
  row: PhaseTemplateRow,
  definitions: ReadonlyArray<PhaseDefinition>,
): PhaseTemplate {
  return {
    id: row.id as PhaseTemplateId,
    workspaceId: row.workspace_id as WorkspaceId,
    name: row.name,
    description: row.description,
    definitions,
    createdAt: row.created_at as IsoDateTime,
    updatedAt: row.updated_at as IsoDateTime,
  };
}

export async function listPhaseTemplates(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<PhaseTemplate>> {
  const rows = await db.select<PhaseTemplateRow>(
    'SELECT * FROM phase_templates WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId],
  );

  const templates: PhaseTemplate[] = [];
  for (const row of rows) {
    const defs = await db.select<PhaseDefinitionRow>(
      'SELECT * FROM phase_definitions WHERE template_id = ? ORDER BY ordinal ASC',
      [row.id],
    );
    const definitions = defs.map(toPhaseDefinition);
    templates.push(toPhaseTemplate(row, definitions));
  }

  return templates;
}

export async function getPhaseTemplate(
  db: Database,
  id: PhaseTemplateId,
): Promise<PhaseTemplate | null> {
  const rows = await db.select<PhaseTemplateRow>('SELECT * FROM phase_templates WHERE id = ?', [
    id,
  ]);
  const row = rows[0];
  if (!row) return null;

  const defs = await db.select<PhaseDefinitionRow>(
    'SELECT * FROM phase_definitions WHERE template_id = ? ORDER BY ordinal ASC',
    [row.id],
  );
  const definitions = defs.map(toPhaseDefinition);

  return toPhaseTemplate(row, definitions);
}

export async function upsertPhaseTemplate(db: Database, template: PhaseTemplate): Promise<void> {
  await db.execute(
    `INSERT INTO phase_templates
      (id, workspace_id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       updated_at = excluded.updated_at`,
    [
      template.id,
      template.workspaceId,
      template.name,
      template.description,
      template.createdAt,
      template.updatedAt,
    ],
  );

  // Delete old definitions and insert new ones
  await db.execute('DELETE FROM phase_definitions WHERE template_id = ?', [template.id]);
  for (const def of template.definitions) {
    await db.execute(
      `INSERT INTO phase_definitions
        (id, template_id, ordinal, name, prompt_prefix, provider_override, model_override)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        def.id,
        template.id,
        def.ordinal,
        def.name,
        def.promptPrefix,
        def.providerOverride ?? null,
        def.modelOverride ?? null,
      ],
    );
  }
}

export async function deletePhaseTemplate(db: Database, id: PhaseTemplateId): Promise<void> {
  await db.execute('DELETE FROM phase_templates WHERE id = ?', [id]);
}
