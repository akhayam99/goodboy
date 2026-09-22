import { describe, expect, it } from 'vitest';
import { extractCapabilityNeed } from '../context/marker-parsing';
import { stripControlMarkers } from '../context/marker-parsing';
import {
  capabilityPurposeForFindingTarget,
  validateCapabilityNeed,
} from './validateCapabilityNeed';

const needBody = (fields: Record<string, unknown>): string =>
  `<<need>>${JSON.stringify(fields)}<</need>>`;

const repairNeed = {
  v: 1,
  agent: 'agent-1',
  target: 'implementer',
  purpose: 'repair',
  question: 'restore the dropped null guard',
  scope: ['apps/desktop/src/store/slices/turn/sendTurn.ts'],
  evidence: ['review:finding-1'],
  gap: 'the failing path was never executed',
  expectedOutput: 'the guard back with a regression test',
  continuation: 'handoff',
};

describe('capability need validation', () => {
  it('accepts a reviewer asking an implementer for a repair', () => {
    const outcome = validateCapabilityNeed({
      assistantText: needBody(repairNeed),
      emittingProvider: null,
      requesterAgentId: 'agent-1',
      requesterRole: 'reviewer',
    });

    expect(outcome.kind).toBe('valid');
    expect(outcome.kind === 'valid' ? outcome.need.targetRole : null).toBe('implementer');
    expect(outcome.kind === 'valid' ? outcome.need.evidenceRefs : []).toEqual(['review:finding-1']);
  });

  it('rejects a need that names an agent other than the emitter', () => {
    const outcome = validateCapabilityNeed({
      assistantText: needBody({ ...repairNeed, agent: 'agent-9' }),
      emittingProvider: null,
      requesterAgentId: 'agent-1',
      requesterRole: 'reviewer',
    });

    expect(outcome).toEqual({
      kind: 'rejected',
      rejection: 'foreign-agent',
      reason: 'the need names an agent that did not emit it',
    });
  });

  it('rejects a target and purpose the requester role does not grant', () => {
    const outcome = validateCapabilityNeed({
      assistantText: needBody({ ...repairNeed, target: 'tester', purpose: 'test' }),
      emittingProvider: null,
      requesterAgentId: 'agent-1',
      requesterRole: 'planner',
    });

    expect(outcome.kind).toBe('rejected');
    expect(outcome.kind === 'rejected' ? outcome.rejection : null).toBe('capability-denied');
    expect(outcome.kind === 'rejected' ? outcome.reason : '').toBe(
      'a planner may not request tester for test',
    );
  });

  it('rejects a malformed body without throwing', () => {
    const outcome = validateCapabilityNeed({
      assistantText: '<<need>>{"v":1,"agent":"agent-1",<</need>>',
      emittingProvider: null,
      requesterAgentId: 'agent-1',
      requesterRole: 'reviewer',
    });

    expect(outcome.kind).toBe('rejected');
    expect(outcome.kind === 'rejected' ? outcome.rejection : null).toBe('malformed-body');
  });

  it('rejects an empty question', () => {
    const outcome = validateCapabilityNeed({
      assistantText: needBody({ ...repairNeed, question: '   ' }),
      emittingProvider: null,
      requesterAgentId: 'agent-1',
      requesterRole: 'reviewer',
    });

    expect(outcome.kind).toBe('rejected');
    expect(outcome.kind === 'rejected' ? outcome.rejection : null).toBe('empty-question');
  });

  it('rejects a continuation the requester role does not support', () => {
    const outcome = validateCapabilityNeed({
      assistantText: needBody({ ...repairNeed, continuation: 'resume' }),
      emittingProvider: null,
      requesterAgentId: 'agent-1',
      requesterRole: 'reviewer',
    });

    expect(outcome.kind).toBe('rejected');
    expect(outcome.kind === 'rejected' ? outcome.rejection : null).toBe('unsupported-continuation');
  });

  it('reports no need when the turn carries none', () => {
    expect(
      validateCapabilityNeed({
        assistantText: 'the review is finished and nothing remains.',
        emittingProvider: null,
        requesterAgentId: 'agent-1',
        requesterRole: 'reviewer',
      }),
    ).toEqual({ kind: 'none' });
  });

  it('persists the canonical investigator when the marker names the debugger alias', () => {
    const outcome = validateCapabilityNeed({
      assistantText: needBody({
        ...repairNeed,
        target: 'debugger',
        purpose: 'diagnosis',
        continuation: 'handoff',
      }),
      emittingProvider: null,
      requesterAgentId: 'agent-1',
      requesterRole: 'reviewer',
    });

    expect(outcome.kind === 'valid' ? outcome.need.targetRole : null).toBe('investigator');
  });

  it('strips the need marker from rendered text', () => {
    const rendered = stripControlMarkers(
      `the guard is gone on the error path.\n\n${needBody(repairNeed)}\n\nthat is the whole review.`,
    );

    expect(rendered).not.toContain('need');
    expect(rendered).toContain('the guard is gone on the error path.');
    expect(rendered).toContain('that is the whole review.');
  });

  it('keeps parsing free of throws on a non-object body', () => {
    expect(
      extractCapabilityNeed({ assistantText: '<<need>>[1,2]<</need>>', emittingProvider: null }),
    ).toEqual({
      kind: 'malformed',
      reason: 'the need body is not a json object',
    });
  });

  it('maps completion finding targets onto obligation purposes', () => {
    expect(capabilityPurposeForFindingTarget({ target: 'implementer' })).toBe('repair');
    expect(capabilityPurposeForFindingTarget({ target: 'planner' })).toBe('replan');
    expect(capabilityPurposeForFindingTarget({ target: 'investigator' })).toBe('diagnosis');
    expect(capabilityPurposeForFindingTarget({ target: 'tester' })).toBe('test');
  });
});
