// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type Step,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';
import { runRouteOf, type RunRouteFacts } from './runRouteOf';

const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });

type PresetParams = {
  readonly key: string;
  readonly name: string;
  readonly stepNames: ReadonlyArray<string>;
};

const aPreset = ({ key, name, stepNames }: PresetParams): Workflow => {
  const workflowId = brandId<WorkflowId>({ value: `workflow-${key}` });
  const steps: ReadonlyArray<Step> = stepNames.map((stepName, index) => ({
    id: brandId<StepId>({ value: `step-${key}-${index}` }),
    workflowId,
    ordinal: index,
    name: stepName,
    promptPrefix: '',
  }));
  return {
    id: workflowId,
    workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
    name,
    description: '',
    steps,
    isPreset: true,
    origin: 'custom',
    createdAt: NOW,
    updatedAt: NOW,
  };
};

const FIX_A_LAYOUT = aPreset({
  key: 'layout',
  name: 'Fix a layout',
  stepNames: ['Find', 'Center', 'Check'],
});

const LAYOUT_AUDIT = aPreset({
  key: 'audit',
  name: 'Layout audit',
  stepNames: ['Scan', 'Report'],
});

const factsOf = (overrides: Partial<RunRouteFacts>): RunRouteFacts => ({
  text: '',
  presets: [FIX_A_LAYOUT],
  roles: [
    { kind: 'scout', label: 'Scout' },
    { kind: 'implementer', label: 'Implementer' },
  ],
  lastPresetId: null,
  defaultShape: 'auto',
  hasTask: false,
  mountCount: 1,
  pullRequest: null,
  fileCount: 0,
  ...overrides,
});

const routeOf = (overrides: Partial<RunRouteFacts>) => runRouteOf({ facts: factsOf(overrides) });

describe('runRouteOf, row 1: you said it', () => {
  it('follows a preset named with a tilde and strips the name from the ask', () => {
    const result = routeOf({ text: '~Fix a layout center the billing page' });

    expect(result.route).toMatchObject({
      row: 1,
      shape: 'plan',
      closeness: 'follow',
      presetName: 'Fix a layout',
      choice: 'Workflow · Preset Fix a layout · Follow it',
      why: 'you picked it',
    });
    expect(result.preset?.id).toBe(FIX_A_LAYOUT.id);
    expect(result.ask).toBe('center the billing page');
  });

  it('starts the role named with an at sign as one agent', () => {
    const result = routeOf({ text: '@Scout where does payments-api validate a refund?' });

    expect(result.route).toMatchObject({
      row: 1,
      shape: 'lead',
      role: 'scout',
      choice: 'Agent · Scout',
    });
    expect(result.role).toBe('scout');
    expect(result.ask).toBe('where does payments-api validate a refund?');
  });

  it('reads the default set for this session or workspace', () => {
    const result = routeOf({ text: 'center every member page', defaultShape: 'plan' });

    expect(result.route).toMatchObject({
      row: 1,
      shape: 'plan',
      choice: 'Workflow · Orchestrated',
      why: 'your default',
    });
  });

  it('wins over every later row', () => {
    const result = routeOf({ text: '@Scout check every page', hasTask: true });

    expect(result.route.row).toBe(1);
  });

  it('ignores a tilde that names no preset of the workspace', () => {
    const result = routeOf({ text: '~Ship it' });

    expect(result.route.row).toBe(6);
  });
});

describe('runRouteOf, row 2: a preset matches the ask', () => {
  it('adapts the preset whose name the ask holds', () => {
    const result = routeOf({ text: 'Fix the layout of the Harborline billing page' });

    expect(result.route).toMatchObject({
      row: 2,
      shape: 'plan',
      closeness: 'adapt',
      presetName: 'Fix a layout',
      choice: 'Workflow · Preset Fix a layout · Adapt as it goes',
      why: 'Your ask matches the preset',
    });
    expect(result.ask).toBe('Fix the layout of the Harborline billing page');
  });

  it('prefers the preset last used in this session when two match', () => {
    const result = routeOf({
      text: 'layout audit of the Northwind pages',
      presets: [FIX_A_LAYOUT, LAYOUT_AUDIT],
      lastPresetId: LAYOUT_AUDIT.id,
    });

    expect(result.preset?.id).toBe(LAYOUT_AUDIT.id);
  });

  it('matches the description and step titles when the name is not in the ask', () => {
    const relay = {
      ...aPreset({
        key: 'relay',
        name: 'Webhook hygiene',
        stepNames: ['Trace duplicate deliveries', 'Add idempotency keys'],
      }),
      description: 'Stop retried webhooks from posting twice.',
    };

    const result = routeOf({
      text: 'notify-relay posts duplicate credits when webhooks are retried',
      presets: [FIX_A_LAYOUT, relay],
    });

    expect(result.route).toMatchObject({
      row: 2,
      closeness: 'adapt',
      presetName: 'Webhook hygiene',
    });
  });

  it('needs two words of the description or steps, so one shared word is not a match', () => {
    const relay = {
      ...aPreset({ key: 'relay', name: 'Webhook hygiene', stepNames: ['Trace deliveries'] }),
      description: 'Stop retried webhooks from posting twice.',
    };

    const result = routeOf({ text: 'rename the webhooks folder', presets: [relay] });

    expect(result.route.row).not.toBe(2);
  });

  it('prefers a preset whose name the ask holds over one that only shares step words', () => {
    const scan = {
      ...aPreset({
        key: 'scan',
        name: 'Page scan',
        stepNames: ['Center billing', 'Center profile'],
      }),
      description: '',
    };

    const result = routeOf({
      text: 'fix the layout: center billing and profile',
      presets: [scan, FIX_A_LAYOUT],
      lastPresetId: scan.id,
    });

    expect(result.preset?.id).toBe(FIX_A_LAYOUT.id);
  });
});

describe('runRouteOf, row 3: a task with an end', () => {
  it('plans when a task is attached', () => {
    const result = routeOf({ text: 'ship the refund retry', hasTask: true });

    expect(result.route).toMatchObject({
      row: 3,
      shape: 'plan',
      choice: 'Workflow · Orchestrated',
      why: 'A task with an end',
    });
  });

  it('plans when the ask names an end state across many places', () => {
    const result = routeOf({ text: 'center every member page', mountCount: 3 });

    expect(result.route).toMatchObject({
      row: 3,
      shape: 'plan',
      why: 'A task with an end, across 3 projects',
    });
  });

  it('plans when the ask is a list', () => {
    const result = routeOf({ text: 'Do these:\n- rename the ledger-core table\n- move the job' });

    expect(result.route.row).toBe(3);
  });
});

describe('runRouteOf, row 4: fixes on an open pull request', () => {
  it('starts one agent when the pull request fails and the ask is about it', () => {
    const result = routeOf({
      text: 'make the checks pass',
      pullRequest: { number: 41, isFailing: true, hasComments: false },
    });

    expect(result.route).toMatchObject({
      row: 4,
      shape: 'lead',
      why: 'Fixes on pull request #41',
    });
  });

  it('skips a pull request that has nothing to fix', () => {
    const result = routeOf({
      text: 'make the checks pass',
      pullRequest: { number: 41, isFailing: false, hasComments: false },
    });

    expect(result.route.row).toBe(6);
  });
});

describe('runRouteOf, row 5: a question, a check or one file', () => {
  it('starts one agent for a question', () => {
    const result = routeOf({ text: 'Which notify-relay handler fires twice?' });

    expect(result.route).toMatchObject({
      row: 5,
      shape: 'lead',
      choice: 'Agent · Auto agent',
      why: 'A question or a check, and no preset fits',
    });
  });

  it('starts one agent for a check', () => {
    const result = routeOf({ text: 'audit the payments-api logs for leaks' });

    expect(result.route.row).toBe(5);
  });

  it('starts one agent when one file is attached', () => {
    const result = routeOf({ text: 'tidy this up', fileCount: 1 });

    expect(result.route).toMatchObject({ row: 5, why: 'One file to look at' });
  });
});

describe('runRouteOf, row 6: nothing above holds', () => {
  it('starts one agent first', () => {
    const result = routeOf({ text: 'make the settings feel calmer' });

    expect(result.route).toMatchObject({
      row: 6,
      shape: 'lead',
      presetName: null,
      choice: 'Agent · Auto agent',
      why: 'Not sure yet: an Auto agent first',
    });
    expect(result.ask).toBe('make the settings feel calmer');
  });
});
