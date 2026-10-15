// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandedId } from '../../../features/history/testing/brandedId';
import type {
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { AppStore } from '../../store';
import { saveRunAsPreset } from './saveRunAsPreset';

const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });
const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const WORKFLOW_ID = brandedId<WorkflowId>({ value: 'wf-settlement' });
const STAMP = brandedId<IsoDateTime>({ value: '2026-10-01T00:00:00.000Z' });

let useAppStore: StoryStore;

const workflow = (overrides: Partial<Workflow> = {}): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Settlement fix',
  description: 'Trace, plan and fix.',
  goal: 'Fix the rounding drift',
  isPreset: false,
  origin: 'custom',
  steps: [
    {
      id: brandedId<StepId>({ value: 'step-1' }),
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Trace',
      role: 'scout',
      promptPrefix: '',
      effort: 'medium',
      verbosity: 'normal',
      modelOverride: 'claude-sonnet-5-5',
      providerOverride: 'anthropic',
    },
    {
      id: brandedId<StepId>({ value: 'step-2' }),
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Fix',
      role: 'implementer',
      promptPrefix: '',
      effort: 'high',
      verbosity: 'normal',
    },
  ],
  createdAt: STAMP,
  updatedAt: STAMP,
  ...overrides,
});

type StoreParams = {
  readonly workflows?: ReadonlyArray<Workflow>;
  readonly existing?: ReadonlyArray<Workflow>;
  readonly runTitle?: string;
};

const savePhaseTemplate = vi.fn<AppStore['savePhaseTemplate']>();

const seed = ({ workflows = [workflow()], existing = [], runTitle }: StoreParams = {}) => {
  const run = aWorkflowRun({
    id: brandedId<WorkflowRunId>({ value: 'run-1' }),
    workflowId: WORKFLOW_ID,
    ...(runTitle !== undefined && { title: runTitle }),
  });
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, workflowRuns: [run] })],
    sessionWorkflows: { [SESSION_ID]: workflows },
    phaseTemplates: { [WORKSPACE_ID]: existing },
    savePhaseTemplate,
  });
  return run.id;
};

const save = (workflowRunId: WorkflowRunId) =>
  saveRunAsPreset(useAppStore.getState)({ sessionId: SESSION_ID, workflowRunId });

const firstArgs = () => savePhaseTemplate.mock.calls[0]![0];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  savePhaseTemplate.mockReset();
  savePhaseTemplate.mockImplementation(async () =>
    workflow({ id: brandedId<WorkflowId>({ value: 'wf-preset-new' }) }),
  );
});

describe('saveRunAsPreset', () => {
  it('saves the steps of the run as a preset with new step ids', async () => {
    const runId = seed();

    await save(runId);

    const args = firstArgs();
    expect(args).toMatchObject({
      workspaceId: WORKSPACE_ID,
      name: 'Settlement fix',
      isPreset: true,
      origin: 'custom',
    });
    expect(args.steps.map((step) => step.name)).toEqual(['Trace', 'Fix']);
    expect(args.steps.every((step) => step.id === undefined)).toBe(true);
    expect(args.steps[0]).toMatchObject({
      providerOverride: 'anthropic',
      modelOverride: 'claude-sonnet-5-5',
    });
  });

  it('names the preset after the run title and never reuses a name', async () => {
    const runId = seed({
      runTitle: 'Idempotent retries',
      existing: [
        workflow({ id: brandedId<WorkflowId>({ value: 'wf-other' }), name: 'Idempotent retries' }),
      ],
    });

    await save(runId);

    expect(firstArgs().name).toBe('Idempotent retries 2');
  });

  it('returns the saved preset', async () => {
    const runId = seed();

    const saved = await save(runId);

    expect(saved.id).toBe('wf-preset-new');
  });

  it('refuses a run the session no longer has', async () => {
    seed();

    await expect(save(brandedId<WorkflowRunId>({ value: 'run-gone' }))).rejects.toThrow(
      'workflow run not found',
    );
  });

  it('refuses a run with no steps yet', async () => {
    const runId = seed({ workflows: [workflow({ steps: [] })] });

    await expect(save(runId)).rejects.toThrow('no steps yet');
    expect(savePhaseTemplate).not.toHaveBeenCalled();
  });
});
