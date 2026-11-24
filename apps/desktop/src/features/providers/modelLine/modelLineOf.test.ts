// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { EffortLevel } from '@goodboy/types';
import { EFFORT_LABEL } from '../../chat/utils/chat-constants';
import { modelLineOf } from './modelLineOf';

type Row = {
  readonly name: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly expected: ReturnType<typeof modelLineOf>;
};

const FIVE: ReadonlyArray<EffortLevel> = ['low', 'medium', 'high', 'xhigh', 'max'];

const ROWS: ReadonlyArray<Row> = [
  {
    name: 'a catalog key with its provider and a high effort',
    provider: 'anthropic',
    model: 'sonnet-5.5',
    effort: 'high',
    expected: {
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'High',
      effortLevel: 'high',
      effortLevels: FIVE,
      isUnknown: false,
      rawId: null,
    },
  },
  {
    name: 'a catalog key with no provider, resolved from the model',
    provider: null,
    model: 'sonnet-5.5',
    effort: 'low',
    expected: {
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'Low',
      effortLevel: 'low',
      effortLevels: FIVE,
      isUnknown: false,
      rawId: null,
    },
  },
  {
    name: 'a full CLI id',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    expected: {
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'Medium',
      effortLevel: 'medium',
      effortLevels: FIVE,
      isUnknown: false,
      rawId: null,
    },
  },
  {
    name: 'the extra high effort word',
    provider: 'anthropic',
    model: 'sonnet-5.5',
    effort: 'xhigh',
    expected: {
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'Very high',
      effortLevel: 'xhigh',
      effortLevels: FIVE,
      isUnknown: false,
      rawId: null,
    },
  },
  {
    name: 'no effort',
    provider: 'anthropic',
    model: 'sonnet-5.5',
    effort: null,
    expected: {
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: null,
      effortLevel: null,
      effortLevels: FIVE,
      isUnknown: false,
      rawId: null,
    },
  },
  {
    name: 'an effort word nobody knows',
    provider: 'anthropic',
    model: 'sonnet-5.5',
    effort: 'turbo',
    expected: {
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: null,
      effortLevel: null,
      effortLevels: FIVE,
      isUnknown: false,
      rawId: null,
    },
  },
  {
    name: 'a model with no effort axis',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    effort: 'high',
    expected: {
      provider: 'anthropic',
      name: 'Haiku 4.5',
      effort: null,
      effortLevel: null,
      effortLevels: [],
      isUnknown: false,
      rawId: null,
    },
  },
  {
    name: 'a retired id on a known provider, by its words',
    provider: 'anthropic',
    model: 'harborline-9000',
    effort: 'high',
    expected: {
      provider: 'anthropic',
      name: 'Harborline 9000',
      effort: null,
      effortLevel: null,
      effortLevels: [],
      isUnknown: true,
      rawId: 'harborline-9000',
    },
  },
  {
    name: 'an unknown id with no provider at all',
    provider: null,
    model: 'harborline-9000',
    effort: null,
    expected: {
      provider: null,
      name: 'Unknown model',
      effort: null,
      effortLevel: null,
      effortLevels: [],
      isUnknown: true,
      rawId: 'harborline-9000',
    },
  },
  {
    name: 'a provider with no model',
    provider: 'anthropic',
    model: null,
    effort: 'high',
    expected: {
      provider: 'anthropic',
      name: 'Claude',
      effort: null,
      effortLevel: null,
      effortLevels: [],
      isUnknown: false,
      rawId: null,
    },
  },
  {
    name: 'nothing known',
    provider: null,
    model: null,
    effort: null,
    expected: null,
  },
];

describe('modelLineOf', () => {
  it.each(ROWS)('says $name', ({ provider, model, effort, expected }) => {
    expect(modelLineOf({ provider, model, effort })).toEqual(expected);
  });

  it('never puts the raw id in the name or the effort of a known model', () => {
    const line = modelLineOf({ provider: 'anthropic', model: 'sonnet-5.5', effort: 'high' });

    expect(line?.name).not.toContain('sonnet-5.5');
    expect(line?.rawId).toBeNull();
  });

  it('keeps the level and the axis a meter needs next to the word', () => {
    const line = modelLineOf({ provider: 'codex', model: 'gpt-6.1-sol', effort: 'xhigh' });

    expect(line?.effort).toBe('Very high');
    expect(line?.effortLevel).toBe('xhigh');
    expect(line?.effortLevels.indexOf('xhigh')).toBe(3);
    expect(line?.effortLevels).toHaveLength(5);
  });

  it('keeps the level the word names when the model clamps what was asked', () => {
    const line = modelLineOf({ provider: 'anthropic', model: 'sonnet-4.5', effort: 'max' });

    expect(line?.effortLevels).toEqual(['low', 'medium', 'high']);
    expect(line?.effortLevel).not.toBeNull();
    expect(EFFORT_LABEL[line?.effortLevel ?? 'minimal']).toBe(line?.effort);
  });
});
