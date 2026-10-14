// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AGENT_KIND_DEFAULTS } from '../../../features/session/agent-kind';
import type { ActivePlan } from './activePlanOf';
import { unchangedPlanNote } from './unchangedPlanNote';

const BEFORE: ActivePlan = {
  id: 'plan-harborline',
  revision: 2,
  bodyMd: '# Backfill the settled batches\n\n## Goal\nEvery batch is settled once.\n',
};

const CHANGE = 'Add a rollback step before the migration';

describe('unchangedPlanNote', () => {
  it('speaks when a change request ends with the same plan', () => {
    expect(
      unchangedPlanNote({
        before: BEFORE,
        after: BEFORE,
        userText: CHANGE,
        hasCaptureError: false,
      }),
    ).toContain('The planner answered without changing the plan');
  });

  it('speaks when the planner wrote a block that is the same plan again', () => {
    const rewritten = { ...BEFORE, revision: 3 };

    expect(
      unchangedPlanNote({
        before: BEFORE,
        after: rewritten,
        userText: CHANGE,
        hasCaptureError: false,
      }),
    ).toContain('The planner answered without changing the plan');
  });

  it('stays quiet when the plan body changed', () => {
    const revised = { ...BEFORE, revision: 3, bodyMd: `${BEFORE.bodyMd}\n## Risks\nNone.\n` };

    expect(
      unchangedPlanNote({
        before: BEFORE,
        after: revised,
        userText: CHANGE,
        hasCaptureError: false,
      }),
    ).toBeNull();
  });

  it('stays quiet when the plan on screen is another one now', () => {
    const other = { ...BEFORE, id: 'plan-northwind' };

    expect(
      unchangedPlanNote({ before: BEFORE, after: other, userText: CHANGE, hasCaptureError: false }),
    ).toBeNull();
  });

  it('stays quiet for a question, which is not a change request', () => {
    expect(
      unchangedPlanNote({
        before: BEFORE,
        after: BEFORE,
        userText: 'Why is the freeze first?',
        hasCaptureError: false,
      }),
    ).toBeNull();
  });

  it('stays quiet when there was no plan before the turn', () => {
    expect(
      unchangedPlanNote({ before: null, after: null, userText: CHANGE, hasCaptureError: false }),
    ).toBeNull();
  });

  it('leaves a plan block that failed to capture to the capture error', () => {
    expect(
      unchangedPlanNote({ before: BEFORE, after: BEFORE, userText: CHANGE, hasCaptureError: true }),
    ).toBeNull();
  });
});

describe('the planner prompt', () => {
  it('tells the planner to write the whole updated plan when the user asks for a change', () => {
    const prompt = AGENT_KIND_DEFAULTS.planner.systemPrompt ?? '';

    expect(prompt).toContain(
      'write the whole updated plan as one plan block, never a patch or a description of the change',
    );
    expect(prompt).toContain('[current-plan]');
  });
});
