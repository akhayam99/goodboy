import { describe, expect, it } from 'vitest';
import type { IsoDateTime, StepId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { migrate, insertWorkspace, type Database as DbInterface } from '@goodboy/db';
import { WorkflowRegistry, WorkflowRegistryError } from './registry';
import { makeTestDatabase } from '@goodboy/db/test-helpers';

const WORKSPACE_ID = 'ws_test' as WorkspaceId;
const FIXED_NOW = '2024-01-01T00:00:00.000Z' as IsoDateTime;

const makeDb = (): DbInterface => makeTestDatabase();

async function makeSeededDb(): Promise<DbInterface> {
  const db = makeDb();
  await migrate(db);
  await insertWorkspace({
    db,
    workspace: {
      id: WORKSPACE_ID,
      name: 'test',
      slug: 'test',
      overrides: {
        defaultProviderId: null,
        defaultBranchPrefix: null,
        defaultVerbosity: null,
        providerBindings: null,
        taskModels: null,
        roleModels: null,
        parallelAgents: null,
        providerPool: null,
        attributionFooter: null,
        replyVoice: null,
        replyStyleNote: null,
        replyTemplateFixed: null,
        replyTemplateNoChange: null,
        resolveOnGithub: null,
        resolveCommitStyle: null,
      },
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
  });
  return db;
}

function makeTemplate(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'pt_001' as WorkflowId,
    workspaceId: WORKSPACE_ID,
    name: 'My Template',
    description: 'desc',
    steps: [
      {
        id: 'pd_001' as StepId,
        workflowId: 'pt_001' as WorkflowId,
        ordinal: 0,
        name: 'Phase One',
        promptPrefix: 'do phase one',
      },
      {
        id: 'pd_002' as StepId,
        workflowId: 'pt_001' as WorkflowId,
        ordinal: 1,
        name: 'Phase Two',
        promptPrefix: 'do phase two',
      },
    ],
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

describe('WorkflowRegistry validation', () => {
  it('throws when template name is empty', async () => {
    const db = await makeSeededDb();
    const registry = new WorkflowRegistry({ db });
    await expect(registry.upsert(makeTemplate({ name: '   ' }))).rejects.toThrow(
      WorkflowRegistryError,
    );
    await expect(registry.upsert(makeTemplate({ name: '   ' }))).rejects.toThrow(
      'template name required',
    );
  });

  it('throws when ordinals have a gap', async () => {
    const db = await makeSeededDb();
    const registry = new WorkflowRegistry({ db });
    const template = makeTemplate({
      steps: [
        {
          id: 'pd_001' as StepId,
          workflowId: 'pt_001' as WorkflowId,
          ordinal: 0,
          name: 'Phase One',
          promptPrefix: '',
        },
        {
          id: 'pd_002' as StepId,
          workflowId: 'pt_001' as WorkflowId,
          ordinal: 2,
          name: 'Phase Three',
          promptPrefix: '',
        },
      ],
    });
    await expect(registry.upsert(template)).rejects.toThrow(WorkflowRegistryError);
    await expect(registry.upsert(template)).rejects.toThrow('ordinals must be contiguous');
  });

  it('throws when a definition has an empty name', async () => {
    const db = await makeSeededDb();
    const registry = new WorkflowRegistry({ db });
    const template = makeTemplate({
      steps: [
        {
          id: 'pd_001' as StepId,
          workflowId: 'pt_001' as WorkflowId,
          ordinal: 0,
          name: '  ',
          promptPrefix: '',
        },
      ],
    });
    await expect(registry.upsert(template)).rejects.toThrow(WorkflowRegistryError);
    await expect(registry.upsert(template)).rejects.toThrow('has empty name');
  });

  it('throws on duplicate definition names', async () => {
    const db = await makeSeededDb();
    const registry = new WorkflowRegistry({ db });
    const template = makeTemplate({
      steps: [
        {
          id: 'pd_001' as StepId,
          workflowId: 'pt_001' as WorkflowId,
          ordinal: 0,
          name: 'Same',
          promptPrefix: '',
        },
        {
          id: 'pd_002' as StepId,
          workflowId: 'pt_001' as WorkflowId,
          ordinal: 1,
          name: 'Same',
          promptPrefix: '',
        },
      ],
    });
    await expect(registry.upsert(template)).rejects.toThrow(WorkflowRegistryError);
    await expect(registry.upsert(template)).rejects.toThrow('duplicate definition name');
  });
});

describe('WorkflowRegistry happy path', () => {
  it('upsert → list returns template', async () => {
    const db = await makeSeededDb();
    const registry = new WorkflowRegistry({ db });
    const template = makeTemplate();

    const returned = await registry.upsert(template);
    expect(returned.id).toBe(template.id);
    expect(returned.name).toBe(template.name);

    const list = await registry.list(WORKSPACE_ID);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(template.id);
  });

  it('get returns template by id', async () => {
    const db = await makeSeededDb();
    const registry = new WorkflowRegistry({ db });
    const template = makeTemplate();
    await registry.upsert(template);

    const found = await registry.get(template.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('My Template');
    expect(found?.steps).toHaveLength(2);
  });

  it('get returns null for unknown id', async () => {
    const db = await makeSeededDb();
    const registry = new WorkflowRegistry({ db });

    const found = await registry.get('pt_unknown' as WorkflowId);
    expect(found).toBeNull();
  });

  it('delete removes template', async () => {
    const db = await makeSeededDb();
    const registry = new WorkflowRegistry({ db });
    const template = makeTemplate();
    await registry.upsert(template);

    await registry.delete(template.id);
    const list = await registry.list(WORKSPACE_ID);
    expect(list).toHaveLength(0);
  });
});
