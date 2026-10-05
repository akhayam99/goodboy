// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  PermissionRuleId,
  ProviderRunId,
  TurnEvent,
} from '@goodboy/types';
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

  it('carries the approval scope, and leaves it unset for events persisted without one', () => {
    const scoped: TurnEvent = {
      kind: 'permission_decision',
      runId: RUN,
      toolUseId: 'tu-scoped',
      decision: 'allow',
      scope: 'session',
      ruleId: null,
      decidedBy: 'user',
      at: AT,
    };
    const items = reduceTranscript([scoped, permDecEvent('tu-legacy')]);
    const [withScope, withoutScope] = items;
    if (withScope?.kind !== 'permission_decision' || withoutScope?.kind !== 'permission_decision') {
      throw new Error('expected two permission_decision items');
    }
    expect(withScope.scope).toBe('session');
    expect(withoutScope.scope).toBeUndefined();
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

const AUTH_BANNER = '__auth_required__:{"providerId":"cursor","identity":null}';
const FALLBACK_NOTE = 'cursor rejected the credentials. retrying on anthropic Sonnet 5.5.';
const REVIEW_AGENT = 'agent-review' as AgentId;

const stepEvent = (runId: ProviderRunId): TurnEvent => ({
  kind: 'step_transition',
  runId,
  fromStep: { ordinal: 9, name: 'Skip bonus steps for the settlement flow' },
  toStep: { ordinal: 10, name: 'Review: skip bonus steps for the settlement flow' },
  carryForwardContext: 'carry me forward',
  fromAgentId: 'agent-previous' as AgentId,
  at: AT,
});

const cursorFallback = (runId: ProviderRunId): ReadonlyArray<TurnEvent> => [
  { kind: 'error', runId, message: AUTH_BANNER, retryable: false, at: AT },
  { kind: 'decision_note', runId, message: FALLBACK_NOTE, at: AT },
];

describe('reduceTranscript, a step turn that fell back to another provider', () => {
  const firstTurn: ReadonlyArray<TurnEvent> = [
    {
      kind: 'orchestrator_decision',
      runId: 'orchestrator' as ProviderRunId,
      action: 'next',
      reason: 'The earlier step changed the rounding, so it needs a review.',
      stepName: 'Review: skip bonus steps for the settlement flow',
      at: AT,
    },
    {
      kind: 'user_text',
      runId: RUN,
      text: '**Goal** Settle batches',
      handoffId: REVIEW_AGENT,
      at: AT,
    },
    stepEvent('run-1' as ProviderRunId),
    ...cursorFallback('run-1' as ProviderRunId),
    stepEvent('run-2' as ProviderRunId),
  ];

  it('shows the first message as a handoff and the step once', () => {
    const items = reduceTranscript(firstTurn);

    expect(items.map((item) => item.kind)).toEqual([
      'orchestrator_decision',
      'handoff',
      'step_transition',
      'auth_required',
      'decision_note',
    ]);
    expect(items[1]).toMatchObject({ handoffId: REVIEW_AGENT });
  });

  it('keeps the same step when the agent moved on in between', () => {
    const items = reduceTranscript([
      ...firstTurn,
      { kind: 'assistant_text', runId: RUN, delta: 'Done.', at: AT },
      stepEvent('run-3' as ProviderRunId),
    ]);

    expect(items.filter((item) => item.kind === 'step_transition')).toHaveLength(2);
  });

  it('shows the credential notice and its decision once when the next turn falls back the same way', () => {
    const items = reduceTranscript([
      ...firstTurn,
      { kind: 'assistant_text', runId: RUN, delta: 'Not created.', at: AT },
      { kind: 'done', runId: RUN, at: AT },
      userTextEvent(
        '<<oq-answers>>\nAnswers to open questions:\n\n- Q: x\n  A: y\n<</oq-answers>>',
      ),
      ...cursorFallback('run-4' as ProviderRunId),
      { kind: 'assistant_text', runId: RUN, delta: 'Reviewed.', at: AT },
    ]);

    expect(items.filter((item) => item.kind === 'auth_required')).toHaveLength(1);
    expect(items.filter((item) => item.kind === 'decision_note')).toHaveLength(1);
    expect(items.at(-1)).toMatchObject({ kind: 'assistant_text' });
  });

  it('shows the notice again when the fallback lands somewhere else', () => {
    const items = reduceTranscript([
      ...firstTurn,
      { kind: 'done', runId: RUN, at: AT },
      { kind: 'error', runId: RUN, message: AUTH_BANNER, retryable: false, at: AT },
      {
        kind: 'decision_note',
        runId: RUN,
        message: 'cursor rejected the credentials. retrying on codex GPT-5.6 Terra.',
        at: AT,
      },
    ]);

    expect(items.filter((item) => item.kind === 'auth_required')).toHaveLength(2);
    expect(items.filter((item) => item.kind === 'decision_note')).toHaveLength(2);
  });
});

describe('reduceTranscript, orchestrator_decision', () => {
  it('carries the operator note through to the transcript item', () => {
    const event = {
      kind: 'orchestrator_decision',
      runId: RUN,
      action: 'next',
      reason: 'the gate landed so the tests come next',
      stepName: 'write the gate tests',
      operatorNote: 'the gate is in place but its tests are missing',
      at: AT,
    } satisfies TurnEvent;

    expect(reduceTranscript([event])).toEqual([
      {
        kind: 'orchestrator_decision',
        key: 'orchestrator-0',
        action: 'next',
        reason: event.reason,
        stepName: event.stepName,
        operatorNote: event.operatorNote,
        at: AT,
      },
    ]);
  });

  it('omits the operator note when the decision has none', () => {
    const event = {
      kind: 'orchestrator_decision',
      runId: RUN,
      action: 'done',
      reason: 'nothing is left to do',
      at: AT,
    } satisfies TurnEvent;

    const item = reduceTranscript([event])[0]!;
    expect(item.kind).toBe('orchestrator_decision');
    if (item.kind !== 'orchestrator_decision') {
      return;
    }
    expect(item.operatorNote).toBeUndefined();
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
    const items = reduceTranscript([userTextEvent('first'), userTextEvent('a normal message')]);
    expect(items).toHaveLength(2);
    expect(items[1]!.kind).toBe('user_text');
  });

  it('detects the oq-answers wrapper despite leading whitespace', () => {
    const items = reduceTranscript([
      userTextEvent('\n\n   <<oq-answers>>\nAnswers:\n- Q: a\n  A: b\n<</oq-answers>>'),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe('oq_answer');
  });

  it('does not treat an inline mention of the marker as an answer', () => {
    const items = reduceTranscript([
      userTextEvent('first'),
      userTextEvent('here is text then <<oq-answers>> later'),
    ]);
    expect(items).toHaveLength(2);
    expect(items[1]!.kind).toBe('user_text');
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
      'handoff',
      'assistant_text',
      'oq_answer',
      'assistant_text',
    ]);
  });
});

const workflowMarker =
  '**Scope** this step only, never a later one. Emit `<<step-done id="agent-1">>` on its own line once it is truly done.';

describe('reduceTranscript, first message', () => {
  it('shows a composed kickoff from before handoffs as the first message, unparsed', () => {
    const kickoff = [
      '**Goal** Ship the onboarding wizard',
      '**Plan**\n1. wire steps',
      'Focus on the providers step only.',
      workflowMarker,
    ].join('\n\n');
    const items = reduceTranscript([userTextEvent(kickoff)]);
    expect(items).toEqual([
      { kind: 'handoff', key: 'handoff-0', handoffId: null, text: kickoff, at: AT },
    ]);
  });

  it('keeps a later kickoff-looking message as a plain user turn', () => {
    const kickoff = `**Goal** Goal text\n\n${workflowMarker}`;
    const items = reduceTranscript([userTextEvent('first'), userTextEvent(kickoff)]);
    expect(items.map((i) => i.kind)).toEqual(['handoff', 'user_text']);
  });

  it('flushes buffered assistant_text before the first message', () => {
    const events: TurnEvent[] = [assistantTextEvent('some assistant output'), userTextEvent('go')];
    const items = reduceTranscript(events);
    expect(items.map((i) => i.kind)).toEqual(['assistant_text', 'handoff']);
  });
});
