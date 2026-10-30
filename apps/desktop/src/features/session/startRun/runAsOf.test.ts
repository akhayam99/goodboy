// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type Workflow,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';
import { AUTO_RUN_AS, runAsRouteOf } from './runAsOf';
import type { RunRouteFacts } from './runRouteOf';

const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });

const FIX_A_LAYOUT: Workflow = {
  id: brandId<WorkflowId>({ value: 'workflow-layout' }),
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
  name: 'Fix a layout',
  description: '',
  steps: [],
  isPreset: true,
  origin: 'custom',
  createdAt: NOW,
  updatedAt: NOW,
};

const ROLES: RunRouteFacts['roles'] = [
  { kind: 'scout', label: 'Scout' },
  { kind: 'reviewer', label: 'Reviewer' },
];

const factsOf = (text: string): RunRouteFacts => ({
  text,
  presets: [FIX_A_LAYOUT],
  roles: ROLES,
  lastPresetId: null,
  defaultShape: 'auto',
  hasTask: false,
  mountCount: 0,
  pullRequest: null,
  fileCount: 0,
});

describe('what Run as makes Start do', () => {
  it('leaves the pick to the rules while it is on Auto', () => {
    const result = runAsRouteOf({ runAs: AUTO_RUN_AS, facts: factsOf('center every page') });

    expect(result.route).toMatchObject({ shape: 'plan', row: 3 });
  });

  it('starts an orchestrated run when picked, whatever the ask looks like', () => {
    const result = runAsRouteOf({
      runAs: { kind: 'orchestrated' },
      facts: factsOf('Which handler fires twice?'),
    });

    expect(result.route).toMatchObject({ shape: 'plan', presetName: null, row: 1 });
    expect(result.ask).toBe('Which handler fires twice?');
  });

  it('starts an Auto agent when picked, even for a task with an end', () => {
    const result = runAsRouteOf({
      runAs: { kind: 'autoAgent' },
      facts: factsOf('center every page'),
    });

    expect(result.route).toMatchObject({ shape: 'lead', role: null, row: 1 });
  });

  it('follows the preset picked and falls back to the rules when it is gone', () => {
    const picked = runAsRouteOf({
      runAs: { kind: 'preset', presetId: FIX_A_LAYOUT.id },
      facts: factsOf('anything'),
    });
    const gone = runAsRouteOf({
      runAs: { kind: 'preset', presetId: 'workflow-deleted' },
      facts: factsOf('Which handler fires twice?'),
    });

    expect(picked.route).toMatchObject({ presetName: 'Fix a layout', closeness: 'follow' });
    expect(picked.preset?.id).toBe(FIX_A_LAYOUT.id);
    expect(gone.route.row).toBe(5);
  });

  it('starts the role picked', () => {
    const result = runAsRouteOf({
      runAs: { kind: 'role', role: 'reviewer' },
      facts: factsOf('look at this'),
    });

    expect(result).toMatchObject({ role: 'reviewer', route: { shape: 'lead', role: 'reviewer' } });
  });

  it('lets a token typed in the text win over the chip', () => {
    const result = runAsRouteOf({
      runAs: { kind: 'orchestrated' },
      facts: factsOf('@Scout look at this'),
    });

    expect(result).toMatchObject({ role: 'scout', ask: 'look at this' });
  });

  it('follows a preset unless the kind says to adapt', () => {
    const presetId = FIX_A_LAYOUT.id;
    const followed = runAsRouteOf({
      runAs: { kind: 'preset', presetId },
      facts: factsOf('center every page'),
    });
    const adapted = runAsRouteOf({
      runAs: { kind: 'preset', presetId, closeness: 'adapt' },
      facts: factsOf('center every page'),
    });

    expect(followed.route).toMatchObject({ presetName: 'Fix a layout', closeness: 'follow' });
    expect(adapted.route).toMatchObject({ presetName: 'Fix a layout', closeness: 'adapt' });
  });
});
