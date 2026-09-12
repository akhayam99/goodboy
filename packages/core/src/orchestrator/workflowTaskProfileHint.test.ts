import { describe, expect, it } from 'vitest';
import { hintedRoutingOutcome, workflowTaskProfileHint } from './workflowTaskProfileHint';

const HEAVY_TEXT = [
  'Refactor the migration runner so every segment is transactional.',
  '```ts',
  'const run = () => {};',
  '```',
].join('\n');

describe('workflowTaskProfileHint', () => {
  it('leaves a profile the agent stated alone', () => {
    const profile = workflowTaskProfileHint({
      profile: { taskType: 'review', difficulty: 'light', basis: 'agent' },
      promptText: HEAVY_TEXT,
    });

    expect(profile).toEqual({ taskType: 'review', difficulty: 'light', basis: 'agent' });
  });

  it('labels a difficulty it read off the step text as heuristic', () => {
    const profile = workflowTaskProfileHint({
      profile: { taskType: 'general', difficulty: 'unknown', basis: 'unknown' },
      promptText: HEAVY_TEXT,
    });

    expect(profile).toEqual({ taskType: 'general', difficulty: 'heavy', basis: 'heuristic' });
  });

  it('keeps the agent task type when only the difficulty is missing', () => {
    const profile = workflowTaskProfileHint({
      profile: { taskType: 'debugging', difficulty: 'unknown', basis: 'agent' },
      promptText: HEAVY_TEXT,
    });

    expect(profile).toEqual({ taskType: 'debugging', difficulty: 'heavy', basis: 'heuristic' });
  });

  it('never reads an unassessable step as light work', () => {
    const profile = workflowTaskProfileHint({
      profile: { taskType: 'general', difficulty: 'unknown', basis: 'unknown' },
      promptText: '',
    });

    expect(profile).toEqual({ taskType: 'general', difficulty: 'unknown', basis: 'unknown' });
  });
});

describe('hintedRoutingOutcome', () => {
  it('hints the profile of a valid proposal without touching its pick', () => {
    const outcome = hintedRoutingOutcome({
      outcome: {
        kind: 'valid',
        proposal: {
          pick: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
          reason: 'The agent chose this model.',
          source: 'agent',
          profile: { taskType: 'planning', difficulty: 'unknown', basis: 'agent' },
        },
      },
      promptText: HEAVY_TEXT,
    });

    expect(outcome.kind).toBe('valid');
    if (outcome.kind !== 'valid') {
      return;
    }
    expect(outcome.proposal.pick).toEqual({
      provider: 'anthropic',
      model: 'opus-5',
      effort: 'high',
    });
    expect(outcome.proposal.profile).toEqual({
      taskType: 'planning',
      difficulty: 'heavy',
      basis: 'heuristic',
    });
  });

  it('keeps an invalid outcome invalid and its requested identity intact', () => {
    const outcome = hintedRoutingOutcome({
      outcome: {
        kind: 'invalid',
        requested: { provider: 'acme', model: 'ghost', effort: null },
        reason: 'Unknown routing provider: acme.',
        profile: { taskType: 'general', difficulty: 'unknown', basis: 'unknown' },
      },
      promptText: HEAVY_TEXT,
    });

    expect(outcome.kind).toBe('invalid');
    if (outcome.kind !== 'invalid') {
      return;
    }
    expect(outcome.requested).toEqual({ provider: 'acme', model: 'ghost', effort: null });
    expect(outcome.profile.basis).toBe('heuristic');
  });

  it('hints a missing outcome and leaves it missing', () => {
    const outcome = hintedRoutingOutcome({
      outcome: {
        kind: 'missing',
        profile: { taskType: 'general', difficulty: 'unknown', basis: 'unknown' },
      },
      promptText: 'hi',
    });

    expect(outcome.kind).toBe('missing');
    if (outcome.kind !== 'missing') {
      return;
    }
    expect(outcome.profile).toEqual({
      taskType: 'general',
      difficulty: 'light',
      basis: 'heuristic',
    });
  });
});
