import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PermissionRuleId, ProviderRunId, TurnEvent } from '@goodboy/types';
import { reduceTranscript } from '../features/chat/utils/transcript-items';

const RUN = 'run-1' as ProviderRunId;
const AT = '2026-01-01T00:00:00.000Z' as IsoDateTime;
const RULE_ID = 'rule-abc' as PermissionRuleId;

function permReqEvent(toolUseId = 'tu-1'): TurnEvent {
  return {
    kind: 'permission_request',
    runId: RUN,
    toolUseId,
    toolName: 'bash',
    input: { cmd: 'ls' },
    at: AT,
  };
}

function permDecEvent(
  toolUseId = 'tu-1',
  decision: 'allow' | 'deny' = 'allow',
  ruleId: PermissionRuleId | null = RULE_ID,
  decidedBy: 'engine' | 'user' | 'default' = 'engine',
): TurnEvent {
  return {
    kind: 'permission_decision',
    runId: RUN,
    toolUseId,
    decision,
    ruleId,
    decidedBy,
    at: AT,
  };
}

describe('reduceTranscript, permission_request', () => {
  it('produces a permission_request item', () => {
    const items = reduceTranscript([permReqEvent()]);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.kind).toBe('permission_request');
    if (item.kind !== 'permission_request') {
      return;
    }
    expect(item.toolName).toBe('bash');
    expect(item.toolUseId).toBe('tu-1');
    expect(item.runId).toBe(RUN);
    expect(item.input).toEqual({ cmd: 'ls' });
    expect(item.at).toBe(AT);
  });

  it('key contains toolUseId', () => {
    const items = reduceTranscript([permReqEvent('tu-xyz')]);
    const item = items[0]!;
    expect(item.key).toContain('tu-xyz');
  });

  it('multiple permission_request events produce separate items', () => {
    const items = reduceTranscript([permReqEvent('tu-1'), permReqEvent('tu-2')]);
    expect(items).toHaveLength(2);
    expect(items[0]!.kind).toBe('permission_request');
    expect(items[1]!.kind).toBe('permission_request');
  });
});

describe('reduceTranscript, permission_decision', () => {
  it('produces a permission_decision item with allow + ruleId', () => {
    const items = reduceTranscript([permDecEvent('tu-1', 'allow', RULE_ID, 'engine')]);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.kind).toBe('permission_decision');
    if (item.kind !== 'permission_decision') {
      return;
    }
    expect(item.decision).toBe('allow');
    expect(item.ruleId).toBe(RULE_ID);
    expect(item.decidedBy).toBe('engine');
    expect(item.runId).toBe(RUN);
  });

  it('produces a deny decision with null ruleId', () => {
    const items = reduceTranscript([permDecEvent('tu-2', 'deny', null, 'default')]);
    const item = items[0]!;
    expect(item.kind).toBe('permission_decision');
    if (item.kind !== 'permission_decision') {
      return;
    }
    expect(item.decision).toBe('deny');
    expect(item.ruleId).toBeNull();
    expect(item.decidedBy).toBe('default');
  });

  it('key contains toolUseId', () => {
    const items = reduceTranscript([permDecEvent('tu-abc')]);
    const item = items[0]!;
    expect(item.key).toContain('tu-abc');
  });

  it('carries toolName from paired permission_request event', () => {
    const items = reduceTranscript([permReqEvent('tu-1'), permDecEvent('tu-1', 'deny', null)]);
    const dec = items[1]!;
    expect(dec.kind).toBe('permission_decision');
    if (dec.kind !== 'permission_decision') {
      return;
    }
    expect(dec.toolName).toBe('bash');
  });

  it('falls back to toolUseId when no prior request event', () => {
    const items = reduceTranscript([permDecEvent('tu-orphan', 'deny', null)]);
    const dec = items[0]!;
    expect(dec.kind).toBe('permission_decision');
    if (dec.kind !== 'permission_decision') {
      return;
    }
    expect(dec.toolName).toBe('tu-orphan');
  });
});

describe('reduceTranscript, request + decision pair', () => {
  it('produces two items for a request followed by a decision', () => {
    const events: TurnEvent[] = [permReqEvent('tu-1'), permDecEvent('tu-1', 'deny', null, 'user')];
    const items = reduceTranscript(events);
    expect(items).toHaveLength(2);
    expect(items[0]!.kind).toBe('permission_request');
    expect(items[1]!.kind).toBe('permission_decision');
  });
});

describe('reduceTranscript, step_transition', () => {
  it('passes degraded handoff metadata through to the transcript item', () => {
    const event = {
      kind: 'step_transition',
      runId: RUN,
      fromStep: { ordinal: 0, name: 'discover' },
      toStep: { ordinal: 1, name: 'plan' },
      carryForwardContext: 'carry me forward',
      degraded: true,
      durationMs: 252_000,
      at: AT,
    } satisfies TurnEvent;

    expect(reduceTranscript([event])).toEqual([
      {
        kind: 'step_transition',
        key: 'phase-0',
        fromStep: event.fromStep,
        toStep: event.toStep,
        carryForwardContext: event.carryForwardContext,
        degraded: true,
        durationMs: 252_000,
        at: AT,
      },
    ]);
  });
});

function userTextEvent(text: string): TurnEvent {
  return { kind: 'user_text', runId: RUN, text, at: AT };
}

function assistantTextEvent(delta: string): TurnEvent {
  return { kind: 'assistant_text', runId: RUN, delta, at: AT };
}

describe('reduceTranscript, open-question answer boundary', () => {
  it('emits an oq_answer marker for a user_text wrapped in oq-answers', () => {
    const items = reduceTranscript([
      userTextEvent('<<oq-answers>>\nAnswers to open questions:\n- Q: a\n  A: b\n<</oq-answers>>'),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe('oq_answer');
  });

  it('keeps ordinary user_text turns', () => {
    const items = reduceTranscript([userTextEvent('a normal message')]);
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe('user_text');
  });

  it('detects the oq-answers wrapper despite leading whitespace', () => {
    const items = reduceTranscript([
      userTextEvent('\n\n   <<oq-answers>>\nAnswers:\n- Q: a\n  A: b\n<</oq-answers>>'),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe('oq_answer');
  });

  it('does not treat an inline mention of the marker as an answer', () => {
    const items = reduceTranscript([userTextEvent('here is text then <<oq-answers>> later')]);
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe('user_text');
  });

  it('carries no answer text on the oq_answer marker (pure boundary)', () => {
    const items = reduceTranscript([
      userTextEvent('<<oq-answers>>\nsecret answer\n<</oq-answers>>'),
    ]);
    const item = items[0]!;
    expect(item.kind).toBe('oq_answer');
    expect(Object.keys(item)).toEqual(['kind', 'key']);
  });

  it('assigns distinct keys to consecutive oq_answer markers', () => {
    const items = reduceTranscript([
      userTextEvent('<<oq-answers>>\na\n<</oq-answers>>'),
      userTextEvent('<<oq-answers>>\nb\n<</oq-answers>>'),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]!.kind).toBe('oq_answer');
    expect(items[1]!.kind).toBe('oq_answer');
    expect(items[0]!.key).not.toBe(items[1]!.key);
  });

  it('flushes buffered assistant_text before emitting the oq_answer marker', () => {
    const events: TurnEvent[] = [
      userTextEvent('ask me something'),
      assistantTextEvent('here is my question'),
      userTextEvent('<<oq-answers>>\nresolved\n<</oq-answers>>'),
      assistantTextEvent('thanks, continuing'),
    ];
    const items = reduceTranscript(events);
    expect(items.map((i) => i.kind)).toEqual([
      'user_text',
      'assistant_text',
      'oq_answer',
      'assistant_text',
    ]);
  });
});

const workflowMarker = [
  'Complete ONLY this workflow step. Do not start later steps or work on their scope.',
  'When this step is fully complete, emit on its own line exactly:',
  '<<step-done id="agent-1">>',
  'Do not emit that marker until the step is truly done.',
].join('\n');

describe('reduceTranscript, workflow kickoff boundary', () => {
  it('maps a composed kickoff to a workflow_kickoff item with parsed sections', () => {
    const kickoff = [
      'Workflow goal:\n\nShip the onboarding wizard',
      'Active plan to execute:\n\n1. wire steps',
      'Focus on the providers step only.',
      workflowMarker,
    ].join('\n\n');
    const items = reduceTranscript([userTextEvent(kickoff)]);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.kind).toBe('workflow_kickoff');
    if (item.kind === 'workflow_kickoff') {
      expect(item.goal).toBe('Ship the onboarding wizard');
      expect(item.instructions).toContain('Focus on the providers step only.');
      expect(item.parsed).toBe(true);
      expect(item.raw).toBe(kickoff);
    }
  });

  it('keeps ordinary user_text turns that are not kickoffs', () => {
    const items = reduceTranscript([userTextEvent('fix the login bug')]);
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe('user_text');
  });

  it('emits a workflow_kickoff even when parsed:false (malformed goal)', () => {
    const malformed = `Workflow goal:\n\n\n\n${workflowMarker}`;
    const items = reduceTranscript([userTextEvent(malformed)]);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.kind).toBe('workflow_kickoff');
    if (item.kind === 'workflow_kickoff') {
      expect(item.parsed).toBe(false);
      expect(item.raw).toBe(malformed);
    }
  });

  it('carries the at timestamp from the event', () => {
    const kickoff = `Workflow goal:\n\nGoal text\n\n${workflowMarker}`;
    const items = reduceTranscript([userTextEvent(kickoff)]);
    const item = items[0]!;
    expect(item.kind).toBe('workflow_kickoff');
    if (item.kind === 'workflow_kickoff') {
      expect(item.at).toBe(AT);
    }
  });

  it('key starts with kickoff-', () => {
    const kickoff = `Workflow goal:\n\nGoal text\n\n${workflowMarker}`;
    const items = reduceTranscript([userTextEvent(kickoff)]);
    const item = items[0]!;
    expect(item.key).toMatch(/^kickoff-/);
  });

  it('multiple kickoff events get distinct keys', () => {
    const kickoff = `Workflow goal:\n\nGoal text\n\n${workflowMarker}`;
    const items = reduceTranscript([userTextEvent(kickoff), userTextEvent(kickoff)]);
    expect(items).toHaveLength(2);
    expect(items[0]!.key).not.toBe(items[1]!.key);
  });

  it('oq_answer takes priority over workflow_kickoff check (oq-answers wrapping)', () => {
    const items = reduceTranscript([
      userTextEvent('<<oq-answers>>\nAnswers:\n- Q: a\n  A: b\n<</oq-answers>>'),
    ]);
    expect(items[0]!.kind).toBe('oq_answer');
  });

  it('flushes buffered assistant_text before a kickoff event', () => {
    const kickoff = `Workflow goal:\n\nGoal text\n\n${workflowMarker}`;
    const events: TurnEvent[] = [
      assistantTextEvent('some assistant output'),
      userTextEvent(kickoff),
    ];
    const items = reduceTranscript(events);
    expect(items.map((i) => i.kind)).toEqual(['assistant_text', 'workflow_kickoff']);
  });

  it('kickoff followed by assistant_text produces both items in order', () => {
    const kickoff = `Workflow goal:\n\nGoal text\n\n${workflowMarker}`;
    const events: TurnEvent[] = [userTextEvent(kickoff), assistantTextEvent('ok, starting')];
    const items = reduceTranscript(events);
    expect(items.map((i) => i.kind)).toEqual(['workflow_kickoff', 'assistant_text']);
  });

  it('kickoff without plan section produces empty instructions', () => {
    const noInstructions = `Workflow goal:\n\nOnly a goal\n\n${workflowMarker}`;
    const items = reduceTranscript([userTextEvent(noInstructions)]);
    const item = items[0]!;
    expect(item.kind).toBe('workflow_kickoff');
    if (item.kind === 'workflow_kickoff') {
      expect(item.instructions).toBe('');
    }
  });
});
