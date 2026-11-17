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
import { suggestedWorkflowOf } from './suggestedWorkflowOf';

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
  it('gives a Lead the preset named with a tilde as its plan and strips the name', () => {
    const result = routeOf({ text: '~Fix a layout center the billing page' });

    expect(result.route).toMatchObject({
      row: 1,
      shape: 'lead',
      closeness: 'follow',
      presetName: 'Fix a layout',
      role: null,
      choice: 'Lead · plan Fix a layout · Keep steps',
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

  it('wins over every later row', () => {
    const result = routeOf({ text: '@Scout check every page', hasTask: true });

    expect(result.route.row).toBe(1);
  });

  it('ignores a tilde that names no preset of the workspace', () => {
    const result = routeOf({ text: '~Ship it' });

    expect(result.route.row).toBe(6);
  });
});

const suggestionOf = (overrides: Partial<RunRouteFacts>) => {
  const facts = factsOf(overrides);
  return suggestedWorkflowOf({ facts, result: runRouteOf({ facts }) });
};

describe('runRouteOf, a workflow that matches the ask is suggested, never adopted', () => {
  it.each(['auto', 'lead', 'plan'] as const)(
    'starts a Lead with no workflow when the stored default is %s',
    (defaultShape) => {
      const result = routeOf({
        text: 'Fix the layout of the Harborline billing page',
        defaultShape,
      });

      expect(result.route).toMatchObject({
        shape: 'lead',
        presetName: null,
        closeness: null,
        choice: 'Lead',
      });
      expect(result.route.row).not.toBe(2);
      expect(result.preset).toBeNull();
      expect(result.ask).toBe('Fix the layout of the Harborline billing page');
    },
  );

  it('suggests the workflow whose name the ask holds', () => {
    expect(suggestionOf({ text: 'Fix the layout of the Harborline billing page' })?.id).toBe(
      FIX_A_LAYOUT.id,
    );
  });

  it.each(['lead', 'plan'] as const)(
    'suggests nothing when the stored default is %s, as Start as said before',
    (defaultShape) => {
      expect(
        suggestionOf({ text: 'Fix the layout of the Harborline billing page', defaultShape }),
      ).toBeNull();
    },
  );

  it('suggests nothing once the ask names a workflow or a role', () => {
    expect(suggestionOf({ text: '~Fix a layout center the billing page' })).toBeNull();
    expect(suggestionOf({ text: '@Scout fix the layout of the billing page' })).toBeNull();
  });

  it('prefers the workflow last used in this session when two match', () => {
    const suggestion = suggestionOf({
      text: 'layout audit of the Northwind pages',
      presets: [FIX_A_LAYOUT, LAYOUT_AUDIT],
      lastPresetId: LAYOUT_AUDIT.id,
    });

    expect(suggestion?.id).toBe(LAYOUT_AUDIT.id);
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

    const suggestion = suggestionOf({
      text: 'notify-relay posts duplicate credits when webhooks are retried',
      presets: [FIX_A_LAYOUT, relay],
    });

    expect(suggestion?.name).toBe('Webhook hygiene');
  });

  it('needs two words of the description or steps, so one shared word is not a match', () => {
    const relay = {
      ...aPreset({ key: 'relay', name: 'Webhook hygiene', stepNames: ['Trace deliveries'] }),
      description: 'Stop retried webhooks from posting twice.',
    };

    expect(suggestionOf({ text: 'rename the webhooks folder', presets: [relay] })).toBeNull();
  });

  it('prefers a workflow whose name the ask holds over one that only shares step words', () => {
    const scan = {
      ...aPreset({
        key: 'scan',
        name: 'Page scan',
        stepNames: ['Center billing', 'Center profile'],
      }),
      description: '',
    };

    const suggestion = suggestionOf({
      text: 'fix the layout: center billing and profile',
      presets: [scan, FIX_A_LAYOUT],
      lastPresetId: scan.id,
    });

    expect(suggestion?.id).toBe(FIX_A_LAYOUT.id);
  });
});

describe('runRouteOf, row 3: a task with an end', () => {
  it('starts a Lead when a task is attached', () => {
    const result = routeOf({ text: 'ship the refund retry', hasTask: true });

    expect(result.route).toMatchObject({
      row: 3,
      shape: 'lead',
      choice: 'Lead',
      why: 'A task with an end',
    });
  });

  it('starts a Lead when the ask names an end state across many places', () => {
    const result = routeOf({ text: 'center every member page', mountCount: 3 });

    expect(result.route).toMatchObject({
      row: 3,
      shape: 'lead',
      why: 'A task with an end, across 3 projects',
    });
  });

  it('starts a Lead when the ask is a list', () => {
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
      choice: 'Lead',
      why: 'A question or a check',
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
      choice: 'Lead',
      why: 'The Lead plans it first',
    });
    expect(result.ask).toBe('make the settings feel calmer');
  });
});

describe('runRouteOf, one engine for new runs', () => {
  it.each([
    { text: '~Fix a layout center the billing page' },
    { text: 'Fix the layout of the Harborline billing page' },
    { text: 'ship the refund retry', hasTask: true },
    { text: 'Do these:\n- rename the ledger-core table\n- move the job' },
    {
      text: 'make the checks pass',
      pullRequest: { number: 41, isFailing: true, hasComments: false },
    },
    { text: 'Which notify-relay handler fires twice?' },
    { text: 'make the settings feel calmer' },
    { text: 'center every member page', defaultShape: 'plan' as const },
    { text: '@Implementer add the retry' },
  ])('never starts the plan engine for $text', (overrides) => {
    expect(routeOf(overrides).route.shape).toBe('lead');
  });
});
