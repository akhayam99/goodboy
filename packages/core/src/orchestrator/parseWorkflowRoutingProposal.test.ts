import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_ROUTING_REASON_LIMIT,
  parseWorkflowRoutingProposal,
} from './parseWorkflowRoutingProposal';
import type { WorkflowRoutingWireFields } from './parseWorkflowRoutingProposal';

const parse = (fields: WorkflowRoutingWireFields) =>
  parseWorkflowRoutingProposal({ fields, emittingProvider: 'codex' });

describe('parseWorkflowRoutingProposal', () => {
  it('reads an absent routing block as missing rather than invalid', () => {
    const outcome = parse({});

    expect(outcome.kind).toBe('missing');
  });

  it('keeps the emitted task profile even when no routing was emitted', () => {
    const outcome = parse({ taskType: 'debugging', difficulty: 'heavy' });

    if (outcome.kind !== 'missing') {
      throw new Error('expected a missing routing outcome');
    }
    expect(outcome.profile).toEqual({
      taskType: 'debugging',
      difficulty: 'heavy',
      basis: 'agent',
    });
  });

  it('treats an omitted provider as the emitting provider', () => {
    const outcome = parse({ model: 'gpt-5.6-sol' });

    if (outcome.kind !== 'valid') {
      throw new Error('expected a valid routing outcome');
    }
    expect(outcome.proposal.pick.provider).toBe('codex');
  });

  it('rejects a provider outside the registry and preserves the request verbatim', () => {
    const outcome = parse({ provider: 'acme', model: 'gpt-5.6-sol' });

    if (outcome.kind !== 'invalid') {
      throw new Error('expected an invalid routing outcome');
    }
    expect(outcome.requested).toEqual({ provider: 'acme', model: 'gpt-5.6-sol', effort: null });
  });

  it('records an omitted provider as null on an invalid request', () => {
    const outcome = parse({ model: 'no-such-model' });

    if (outcome.kind !== 'invalid') {
      throw new Error('expected an invalid routing outcome');
    }
    expect(outcome.requested.provider).toBeNull();
    expect(outcome.requested.model).toBe('no-such-model');
  });

  it('separates an unknown model from an omitted routing block', () => {
    const outcome = parse({ provider: 'anthropic', model: 'not-in-the-catalog' });

    expect(outcome.kind).toBe('invalid');
  });

  it('treats an empty model string as invalid, not as an omission', () => {
    const outcome = parse({ model: '   ' });

    expect(outcome.kind).toBe('invalid');
  });

  it('rejects an effort outside the effort scale', () => {
    const outcome = parse({ provider: 'anthropic', model: 'sonnet-5', effort: 'turbo' });

    if (outcome.kind !== 'invalid') {
      throw new Error('expected an invalid routing outcome');
    }
    expect(outcome.requested.effort).toBe('turbo');
  });

  it('accepts an effort the model does not support and leaves normalization to the resolver', () => {
    const outcome = parse({ provider: 'anthropic', model: 'sonnet-5', effort: 'max' });

    if (outcome.kind !== 'valid') {
      throw new Error('expected a valid routing outcome');
    }
    expect(outcome.proposal.pick.effort).toBe('max');
  });

  it('turns a malformed profile into unknown without calling it light', () => {
    const outcome = parse({ model: 'gpt-5.6-sol', taskType: 'vibes', difficulty: 7 });

    if (outcome.kind !== 'valid') {
      throw new Error('expected a valid routing outcome');
    }
    expect(outcome.proposal.profile).toEqual({
      taskType: 'general',
      difficulty: 'unknown',
      basis: 'unknown',
    });
  });

  it('caps an oversized model reason at the storage limit', () => {
    const outcome = parse({ model: 'gpt-5.6-sol', modelReason: 'x'.repeat(900) });

    if (outcome.kind !== 'valid') {
      throw new Error('expected a valid routing outcome');
    }
    expect(Array.from(outcome.proposal.reason).length).toBe(WORKFLOW_ROUTING_REASON_LIMIT);
  });
});
