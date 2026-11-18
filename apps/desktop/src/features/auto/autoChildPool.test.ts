// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AUTO_OWN_PROVIDERS, type AutoDelegationRole } from '@goodboy/core/auto';
import type { ProviderPolicy } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import { autoChildPool } from './autoChildPool';
import { workspaceProviderPool } from './workspaceProviderPool';

const POOLED_RUN = aWorkflowRun({ providerPool: ['codex'] });
const SESSION = aSession({ workflowRuns: [POOLED_RUN] });

const EVERY_PROVIDER: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'codex', state: 'on' },
  { id: 'cursor', state: 'on' },
  { id: 'gemini', state: 'on' },
];

type PoolParams = {
  readonly policy: ProviderPolicy | null;
  readonly isInRun?: boolean;
  readonly role?: AutoDelegationRole;
};

const poolOf = ({ policy, isInRun = false, role = 'implementer' }: PoolParams) =>
  autoChildPool({
    sessions: [SESSION],
    sessionId: SESSION.id,
    workflowRunId: isInRun ? POOLED_RUN.id : null,
    policy,
    role,
  });

describe('allowed providers of an Auto tree', () => {
  it('offers Claude and Codex to a writing child and never Cursor or Gemini', () => {
    expect(poolOf({ policy: null })).toEqual(['anthropic', 'codex']);
    expect(poolOf({ policy: EVERY_PROVIDER })).toEqual(['anthropic', 'codex']);
  });

  it('offers a reading child every provider Auto runs on that the workspace left on', () => {
    expect(poolOf({ policy: null, role: 'planner' })).toEqual(AUTO_OWN_PROVIDERS);
    expect(
      poolOf({
        policy: [
          { id: 'anthropic', state: 'off' },
          { id: 'cursor', state: 'on' },
        ],
        role: 'scout',
      }),
    ).toEqual(['cursor']);
  });

  it('drops a provider the workspace turned off', () => {
    const policy: ProviderPolicy = [
      { id: 'anthropic', state: 'on' },
      { id: 'codex', state: 'off' },
    ];

    expect(poolOf({ policy })).toEqual(['anthropic']);
  });

  it('keeps a backup provider, which is still one the workspace can use', () => {
    const policy: ProviderPolicy = [
      { id: 'anthropic', state: 'on' },
      { id: 'codex', state: 'backup' },
      { id: 'cursor', state: 'off' },
    ];

    expect(poolOf({ policy })).toEqual(['anthropic', 'codex']);
  });

  it('lets a run pool win over the workspace policy', () => {
    const policy: ProviderPolicy = [
      { id: 'anthropic', state: 'on' },
      { id: 'codex', state: 'off' },
    ];

    expect(poolOf({ policy, isInRun: true })).toEqual(['codex']);
  });

  it('is empty when the pool names no provider an Auto tree may use', () => {
    const policy: ProviderPolicy = [
      { id: 'anthropic', state: 'off' },
      { id: 'codex', state: 'off' },
      { id: 'gemini', state: 'on' },
    ];

    expect(poolOf({ policy })).toEqual([]);
  });
});

describe('workspaceProviderPool', () => {
  it('is open without a policy or when nothing is off', () => {
    expect(workspaceProviderPool({ policy: null })).toBeNull();
    expect(workspaceProviderPool({ policy: EVERY_PROVIDER })).toBeNull();
  });

  it('lists what is not off, and is open when everything is off', () => {
    expect(
      workspaceProviderPool({
        policy: [
          { id: 'anthropic', state: 'on' },
          { id: 'codex', state: 'off' },
        ],
      }),
    ).toEqual(['anthropic']);
    expect(workspaceProviderPool({ policy: [{ id: 'anthropic', state: 'off' }] })).toBeNull();
  });
});
