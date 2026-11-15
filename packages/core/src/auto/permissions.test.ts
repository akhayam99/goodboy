import { describe, expect, it } from 'vitest';
import type { AutoLevel } from './level';
import {
  LEAD_PERMISSION_KEYS,
  leadPermissionsOf,
  parseLeadPermissionRows,
  type LeadPermissionLayers,
  type LeadPermissionRows,
} from './permissions';

const TODAY_OF_LEVEL = {
  step: {
    approvePlan: 'ask',
    startReaders: 'ask',
    startWriters: 'ask',
    push: 'whenChecksPass',
    pullRequest: 'allow',
    dependencies: 'allow',
    protectedFiles: 'allow',
    addProject: 'ask',
    closeWork: 'you',
  },
  plan: {
    approvePlan: 'ask',
    startReaders: 'free',
    startWriters: 'afterPlan',
    push: 'whenChecksPass',
    pullRequest: 'allow',
    dependencies: 'allow',
    protectedFiles: 'allow',
    addProject: 'whenAllowed',
    closeWork: 'you',
  },
  run: {
    approvePlan: 'skip',
    startReaders: 'free',
    startWriters: 'free',
    push: 'whenChecksPass',
    pullRequest: 'allow',
    dependencies: 'allow',
    protectedFiles: 'allow',
    addProject: 'allow',
    closeWork: 'you',
  },
} satisfies Readonly<Record<AutoLevel, LeadPermissionRows>>;

const LEVELS: ReadonlyArray<AutoLevel> = ['step', 'plan', 'run'];

const NO_ROWS: LeadPermissionLayers = {
  leadRows: {},
  defaultRows: {},
  sessionLevel: null,
  workspaceLevel: null,
  isPlanApprovalOff: false,
  isWorkFlowOn: true,
};

type ValuesParams = { readonly layers: Partial<LeadPermissionLayers> };

const valuesOf = ({ layers }: ValuesParams) => {
  const { rows } = leadPermissionsOf({ ...NO_ROWS, ...layers, spendLimitUsd: null });
  return Object.fromEntries(LEAD_PERMISSION_KEYS.map((key) => [key, rows[key].value]));
};

describe('leadPermissionsOf', () => {
  it.each(
    LEVELS.flatMap((level) => [true, false].map((isWorkFlowOn) => [level, isWorkFlowOn] as const)),
  )('reads the %s level as today with no stored rows, switch on %s', (level, isWorkFlowOn) => {
    const session = valuesOf({ layers: { sessionLevel: level, isWorkFlowOn } });
    const workspace = valuesOf({ layers: { workspaceLevel: level, isWorkFlowOn } });
    expect(session).toEqual(TODAY_OF_LEVEL[level]);
    expect(workspace).toEqual(TODAY_OF_LEVEL[level]);
  });

  it('adds no ask in a preset that its level does not have today', () => {
    for (const level of LEVELS) {
      const { rows, preset } = leadPermissionsOf({
        ...NO_ROWS,
        sessionLevel: level,
        spendLimitUsd: null,
      });
      expect(preset).toBe(level);
      for (const key of ['push', 'pullRequest', 'dependencies', 'protectedFiles'] as const) {
        expect(rows[key].value).not.toBe('ask');
      }
    }
  });

  it('falls back to After the plan when no level is stored anywhere', () => {
    const { rows, preset } = leadPermissionsOf({ ...NO_ROWS, spendLimitUsd: null });
    expect(preset).toBe('plan');
    expect(rows.startWriters).toEqual({ value: 'afterPlan', source: 'workspace', note: null });
  });

  it('takes the Lead row first, then the default, then the session level, then the workspace level', () => {
    const layers: LeadPermissionLayers = {
      ...NO_ROWS,
      leadRows: { push: 'ask' },
      defaultRows: { push: 'whenChecksPass', dependencies: 'ask' },
      sessionLevel: 'step',
      workspaceLevel: 'run',
    };
    const { rows } = leadPermissionsOf({ ...layers, spendLimitUsd: 4 });
    expect(rows.push).toEqual({ value: 'ask', source: 'lead', note: null });
    expect(rows.dependencies).toEqual({ value: 'ask', source: 'default', note: null });
    expect(rows.startReaders).toEqual({ value: 'ask', source: 'session', note: null });
    const withoutSession = leadPermissionsOf({ ...layers, sessionLevel: null, spendLimitUsd: 4 });
    expect(withoutSession.rows.startReaders).toEqual({
      value: 'free',
      source: 'workspace',
      note: null,
    });
  });

  it('ignores the workspace default with the switch off and keeps the Lead rows', () => {
    const { rows } = leadPermissionsOf({
      ...NO_ROWS,
      leadRows: { pullRequest: 'ask' },
      defaultRows: { push: 'ask' },
      sessionLevel: 'plan',
      isWorkFlowOn: false,
      spendLimitUsd: null,
    });
    expect(rows.pullRequest.source).toBe('lead');
    expect(rows.push).toEqual({ value: 'whenChecksPass', source: 'session', note: null });
  });

  it('reads After the plan as Ask when the plan is skipped, and says so', () => {
    const { rows, preset } = leadPermissionsOf({
      ...NO_ROWS,
      leadRows: { approvePlan: 'skip' },
      sessionLevel: 'plan',
      spendLimitUsd: null,
    });
    expect(rows.startWriters).toEqual({ value: 'ask', source: 'session', note: 'askWithoutPlan' });
    expect(preset).toBe('custom');
    const stored = leadPermissionsOf({
      ...NO_ROWS,
      defaultRows: { startWriters: 'afterPlan' },
      sessionLevel: 'run',
      spendLimitUsd: null,
    });
    expect(stored.rows.startWriters).toEqual({
      value: 'ask',
      source: 'default',
      note: 'askWithoutPlan',
    });
  });

  it('lets the hidden plan setting stand for today only while no row holds the plan', () => {
    const today = leadPermissionsOf({
      ...NO_ROWS,
      sessionLevel: 'plan',
      isPlanApprovalOff: true,
      spendLimitUsd: null,
    });
    expect(today.rows.approvePlan).toEqual({ value: 'skip', source: 'setting', note: null });
    expect(today.rows.startWriters).toEqual({ value: 'free', source: 'setting', note: null });
    expect(today.rows.startReaders.value).toBe('free');
    const step = leadPermissionsOf({
      ...NO_ROWS,
      sessionLevel: 'step',
      isPlanApprovalOff: true,
      spendLimitUsd: null,
    });
    expect(step.rows.approvePlan.value).toBe('skip');
    expect(step.rows.startWriters).toEqual({ value: 'ask', source: 'session', note: null });
  });

  it('never lets the hidden plan setting override a visible Ask', () => {
    const onDefault = leadPermissionsOf({
      ...NO_ROWS,
      defaultRows: { approvePlan: 'ask' },
      sessionLevel: 'plan',
      isPlanApprovalOff: true,
      spendLimitUsd: null,
    });
    expect(onDefault.rows.approvePlan).toEqual({ value: 'ask', source: 'default', note: null });
    expect(onDefault.rows.startWriters.value).toBe('afterPlan');
    const onLead = leadPermissionsOf({
      ...NO_ROWS,
      leadRows: { approvePlan: 'ask' },
      sessionLevel: 'run',
      isPlanApprovalOff: true,
      spendLimitUsd: null,
    });
    expect(onLead.rows.approvePlan).toEqual({ value: 'ask', source: 'lead', note: null });
  });

  it('flags a stored writer row against the hidden setting instead of freeing it', () => {
    const { rows } = leadPermissionsOf({
      ...NO_ROWS,
      leadRows: { startWriters: 'afterPlan' },
      sessionLevel: 'plan',
      isPlanApprovalOff: true,
      spendLimitUsd: null,
    });
    expect(rows.startWriters).toEqual({ value: 'ask', source: 'lead', note: 'askWithoutPlan' });
  });

  it('reads Custom once a row differs from every preset and carries the limit and locked rows', () => {
    const custom = leadPermissionsOf({
      ...NO_ROWS,
      leadRows: { dependencies: 'ask' },
      sessionLevel: 'run',
      spendLimitUsd: 12,
    });
    expect(custom.preset).toBe('custom');
    expect(custom.spendLimitUsd).toBe(12);
    expect(custom.locked).toEqual([
      'forcePushAsks',
      'mergeIsYou',
      'agentsNeverPush',
      'leadNeverWrites',
    ]);
    const same = leadPermissionsOf({
      ...NO_ROWS,
      leadRows: { startReaders: 'ask' },
      sessionLevel: 'step',
      spendLimitUsd: null,
    });
    expect(same.preset).toBe('step');
  });
});

describe('parseLeadPermissionRows', () => {
  it('keeps the known rows with a valid value and drops the rest', () => {
    expect(
      parseLeadPermissionRows({
        raw: JSON.stringify({
          push: 'ask',
          closeWork: 'robot',
          forcePush: 'allow',
          addProject: 'allow',
        }),
      }),
    ).toEqual({ push: 'ask', addProject: 'allow' });
  });

  it('reads nothing from a missing, broken or non object value', () => {
    expect(parseLeadPermissionRows({ raw: null })).toEqual({});
    expect(parseLeadPermissionRows({ raw: '{' })).toEqual({});
    expect(parseLeadPermissionRows({ raw: '["push"]' })).toEqual({});
  });
});
