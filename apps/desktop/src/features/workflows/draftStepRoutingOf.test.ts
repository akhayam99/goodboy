// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type ProviderId,
  type RoleModelPreferences,
  type Step,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';
import { draftFromWorkflow } from './engine';
import { draftStepRoutingOf } from './draftStepRoutingOf';
import { presetStepMarksOf } from './presetStepMarksOf';

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'wf-harborline-release' });
const AT = brandId<IsoDateTime>({ value: '2026-10-17T08:00:00.000Z' });

type StepParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly patch: Partial<Step>;
};

const stepOf = ({ id, ordinal, patch }: StepParams): Step => ({
  id: brandId<StepId>({ value: id }),
  workflowId: WORKFLOW_ID,
  ordinal,
  name: `Step ${ordinal + 1}`,
  promptPrefix: '',
  ...patch,
});

const STEPS: ReadonlyArray<Step> = [
  stepOf({ id: 'scout', ordinal: 0, patch: { role: 'scout' } }),
  stepOf({ id: 'planner', ordinal: 1, patch: { role: 'planner' } }),
  stepOf({
    id: 'implementer',
    ordinal: 2,
    patch: {
      role: 'implementer',
      routingDecision: {
        version: 1,
        proposal: null,
        selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        source: 'agent',
        reason: 'The ledger-core refactor needs deep reasoning.',
        adjustment: 'none',
        executed: null,
      },
    },
  }),
  stepOf({ id: 'reviewer', ordinal: 3, patch: { role: 'reviewer', providerOverride: 'gemini' } }),
];

const PRESET: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: brandId<WorkspaceId>({ value: 'ws-harborline' }),
  name: 'Ship notify-relay',
  description: '',
  steps: STEPS,
  isPreset: true,
  createdAt: AT,
  updatedAt: AT,
};

const ROLE_MODELS: RoleModelPreferences = {
  planner: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'medium' },
};

const SESSION_PROVIDER: ProviderId = 'anthropic';

const CONNECTED: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'gemini'];

describe('draftStepRoutingOf', () => {
  it('gives each lane step the provider its preset mark shows', () => {
    const marks = presetStepMarksOf({
      steps: STEPS,
      roleModels: ROLE_MODELS,
      sessionProvider: SESSION_PROVIDER,
      connectedProviders: CONNECTED,
      scope: null,
    });
    const lane = draftFromWorkflow({ workflow: PRESET }).steps.map(
      (draft) =>
        draftStepRoutingOf({
          draft,
          roleModels: ROLE_MODELS,
          sessionProvider: SESSION_PROVIDER,
          scope: null,
        }).provider,
    );

    expect(lane).toEqual(marks.map((mark) => mark.provider));
    expect(lane).toEqual(['anthropic', 'codex', 'codex', 'gemini']);
  });

  it('follows a provider the user pins in the lane over the decided one', () => {
    const decided = draftFromWorkflow({ workflow: PRESET }).steps[2];
    if (decided === undefined) {
      throw new Error('missing step');
    }
    const pinned = { ...decided, provider: SESSION_PROVIDER, model: '' };

    expect(
      draftStepRoutingOf({
        draft: pinned,
        roleModels: ROLE_MODELS,
        sessionProvider: SESSION_PROVIDER,
        scope: null,
      }).provider,
    ).toBe('anthropic');
    expect(
      draftStepRoutingOf({
        draft: pinned,
        roleModels: ROLE_MODELS,
        sessionProvider: SESSION_PROVIDER,
        scope: null,
        isPinKept: false,
      }).provider,
    ).toBe('codex');
  });
});
