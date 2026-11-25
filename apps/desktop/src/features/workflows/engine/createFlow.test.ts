// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { getWorkflow, insertWorkspace, saveWorkflow } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  brandId,
  type IsoDateTime,
  type StepId,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';
import { blankWorkflowDraft } from './blankWorkflowDraft';
import { createBlockOf } from './createBlockOf';
import { duplicateWorkflowDraft } from './duplicateWorkflowDraft';
import { hasWorkflowDraftContent } from './hasWorkflowDraftContent';
import { pinRoleSteps } from './pinRoleSteps';
import { rolePinOf } from './rolePinOf';
import { stepDraftsOfArgs } from './stepDraftsOfArgs';
import {
  draftFromWorkflow,
  upsertArgsFromDraft,
  type StepDraft,
  type WorkflowDraft,
} from './index';

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `key-${Math.random()}`) });

const step = (overrides: Partial<StepDraft> = {}): StepDraft => ({
  key: 'k-1',
  sourceStepId: null,
  libraryStepId: null,
  role: 'reviewer',
  name: 'Check ledger-core',
  prompt: 'Check it',
  expectedOutput: '',
  provider: '',
  model: '',
  effort: 'medium',
  verbosity: 'normal',
  size: null,
  ...overrides,
});

const NO_NAMES: ReadonlySet<string> = new Set();

describe('createBlockOf', () => {
  it('asks for a name first', () => {
    expect(
      createBlockOf({ draft: blankWorkflowDraft(), takenNames: NO_NAMES, isDrafting: false }),
    ).toEqual({
      reason: 'Name it first',
      nameError: null,
    });
  });

  it('asks for one step once there is a name', () => {
    const draft = { ...blankWorkflowDraft(), name: 'Harborline release' };
    expect(createBlockOf({ draft, takenNames: NO_NAMES, isDrafting: false }).reason).toBe(
      'Add one step or draft them',
    );
  });

  it('says the steps are being drafted', () => {
    const draft = { ...blankWorkflowDraft(), name: 'Harborline release' };
    expect(createBlockOf({ draft, takenNames: NO_NAMES, isDrafting: true }).reason).toBe(
      'Steps are being drafted',
    );
  });

  it('names a step that has no name', () => {
    const draft = {
      ...blankWorkflowDraft(),
      name: 'Harborline release',
      steps: [step({ name: ' ' })],
    };
    expect(createBlockOf({ draft, takenNames: NO_NAMES, isDrafting: false }).reason).toBe(
      'Name every step',
    );
  });

  it('puts a name already taken on the name field and not under Create', () => {
    const draft = { ...blankWorkflowDraft(), name: ' Harborline release ', steps: [step()] };
    expect(
      createBlockOf({ draft, takenNames: new Set(['Harborline release']), isDrafting: false }),
    ).toEqual({ reason: null, nameError: 'A workflow named Harborline release exists' });
  });

  it('lets a named workflow with a named step through', () => {
    const draft = { ...blankWorkflowDraft(), name: 'Harborline release', steps: [step()] };
    expect(createBlockOf({ draft, takenNames: NO_NAMES, isDrafting: false })).toEqual({
      reason: null,
      nameError: null,
    });
  });
});

describe('a draft of a workflow', () => {
  it('has no content until something is typed, picked or added', () => {
    expect(hasWorkflowDraftContent({ draft: blankWorkflowDraft() })).toBe(false);
    expect(hasWorkflowDraftContent({ draft: { ...blankWorkflowDraft(), stopRule: ' x ' } })).toBe(
      true,
    );
    expect(hasWorkflowDraftContent({ draft: { ...blankWorkflowDraft(), isOrderKept: true } })).toBe(
      true,
    );
    expect(hasWorkflowDraftContent({ draft: { ...blankWorkflowDraft(), steps: [step()] } })).toBe(
      true,
    );
  });

  it('duplicates every field under a copy name with steps that belong to no saved step', () => {
    const source: WorkflowDraft = {
      ...blankWorkflowDraft(),
      name: 'Fix a bug ',
      description: 'A test fails',
      entryCheck: 'Reproduce it',
      stopRule: 'It never fails',
      thenSuggestId: brandId<WorkflowId>({ value: 'wf-2' }),
      isOrderKept: true,
      origin: 'library',
      steps: [
        step({
          sourceStepId: brandId<StepId>({ value: 'step-9' }),
          provider: 'codex',
          model: 'gpt-5.6-terra',
        }),
      ],
    };

    const copy = duplicateWorkflowDraft({ source });

    expect(copy).toMatchObject({
      name: 'Fix a bug copy',
      description: 'A test fails',
      entryCheck: 'Reproduce it',
      stopRule: 'It never fails',
      thenSuggestId: 'wf-2',
      isOrderKept: true,
      origin: 'custom',
    });
    expect(copy.steps[0]).toMatchObject({ sourceStepId: null, provider: 'codex' });
    expect(copy.steps[0]?.key).not.toBe('k-1');
  });

  it('turns drafted step args into editable steps', () => {
    const steps = stepDraftsOfArgs({
      steps: [
        {
          ordinal: 0,
          name: 'Reproduce',
          promptPrefix: 'Reproduce it',
          role: 'scout',
          effort: 'high',
        },
      ],
    });

    expect(steps).toMatchObject([
      { name: 'Reproduce', prompt: 'Reproduce it', role: 'scout', effort: 'high', provider: '' },
    ]);
  });
});

describe('role model pins', () => {
  const steps = [
    step({ key: 'a', role: 'reviewer' }),
    step({ key: 'b', role: 'reviewer' }),
    step({ key: 'c', role: 'scout' }),
  ];

  it('follows Every run until a model is pinned', () => {
    expect(rolePinOf({ steps, role: 'reviewer' })).toEqual({ kind: 'follows' });
    expect(rolePinOf({ steps, role: 'tester' })).toEqual({ kind: 'follows' });
  });

  it('pins every step of one role and leaves the others', () => {
    const pinned = pinRoleSteps({
      steps,
      role: 'reviewer',
      route: { provider: 'codex', model: 'gpt-5.6-terra' },
    });

    expect(rolePinOf({ steps: pinned, role: 'reviewer' })).toEqual({
      kind: 'pinned',
      provider: 'codex',
      model: 'gpt-5.6-terra',
    });
    expect(rolePinOf({ steps: pinned, role: 'scout' })).toEqual({ kind: 'follows' });
  });

  it('drops the stored routing of a step when its role is pinned or reset', () => {
    const locked = [
      step({
        key: 'a',
        provider: 'codex',
        model: 'gpt-5.6-terra',
        routingLock: {
          version: 1,
          pick: { provider: 'codex', model: 'gpt-5.6-terra', effort: 'high' },
          origin: 'user',
        },
      }),
    ];

    const pinned = pinRoleSteps({
      steps: locked,
      role: 'reviewer',
      route: { provider: 'anthropic', model: 'claude-opus-5-5' },
    });
    const reset = pinRoleSteps({ steps: locked, role: 'reviewer', route: null });

    expect(pinned[0]).toMatchObject({ routingLock: null, routingDecision: null });
    expect(reset[0]).toMatchObject({ routingLock: null, routingDecision: null });
  });

  it('reads steps with different pins as set per step, and Reset clears them', () => {
    const mixed = [
      step({ key: 'a', provider: 'codex', model: 'gpt-5.6-terra' }),
      step({ key: 'b', provider: 'anthropic', model: 'claude-opus-5-5' }),
    ];

    expect(rolePinOf({ steps: mixed, role: 'reviewer' })).toEqual({ kind: 'mixed' });
    const reset = pinRoleSteps({ steps: mixed, role: 'reviewer', route: null });
    expect(rolePinOf({ steps: reset, role: 'reviewer' })).toEqual({ kind: 'follows' });
  });
});

describe('the four guide fields', () => {
  it('save and reload through sqlite, a cleared field stays cleared', async () => {
    const db = await makeMigratedTestDatabase();
    const workspaceId = brandId<WorkspaceId>({ value: 'ws-harborline' });
    await insertWorkspace({
      db,
      workspace: {
        id: workspaceId,
        name: 'Harborline',
        slug: 'harborline',
        overrides: EMPTY_OVERRIDES,
        createdAt: brandId<IsoDateTime>({ value: '2026-01-01T00:00:00.000Z' }),
        updatedAt: brandId<IsoDateTime>({ value: '2026-01-01T00:00:00.000Z' }),
      },
    });
    const other = await saveWorkflow(db, {
      workspaceId,
      name: 'Plan and ship',
      description: 'Ship it',
      steps: [{ ordinal: 0, name: 'Plan', promptPrefix: 'Plan it', role: 'planner' }],
    });
    const draft = {
      ...blankWorkflowDraft(),
      name: 'Fix a flaky test',
      description: 'A test fails some of the time',
      entryCheck: ' Run it ten times ',
      stopRule: 'It never fails',
      thenSuggestId: other.id,
      isOrderKept: true,
      steps: [step()],
    };

    const saved = await saveWorkflow(db, upsertArgsFromDraft({ draft, workspaceId }));
    const reloaded = await getWorkflow(db, saved.id);
    if (reloaded === null) {
      throw new Error('the workflow did not save');
    }

    expect(reloaded).toMatchObject({
      description: 'A test fails some of the time',
      entryCheck: 'Run it ten times',
      stopRule: 'It never fails',
      thenSuggestId: other.id,
      isOrderKept: true,
    });
    const cleared = await saveWorkflow(
      db,
      upsertArgsFromDraft({
        draft: {
          ...draftFromWorkflow({ workflow: reloaded }),
          stopRule: '',
          thenSuggestId: null,
          isOrderKept: false,
        },
        workspaceId,
        id: saved.id,
      }),
    );
    expect(cleared.stopRule ?? '').toBe('');
    expect(cleared.thenSuggestId ?? null).toBeNull();
    expect(cleared.isOrderKept ?? false).toBe(false);
  });
});
