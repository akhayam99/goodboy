// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { modelLineOf } from './modelLineOf';

type Row = {
  readonly name: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly expected: ReturnType<typeof modelLineOf>;
};

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
});
