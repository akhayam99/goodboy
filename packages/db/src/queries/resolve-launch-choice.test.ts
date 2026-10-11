import { describe, expect, it } from 'vitest';
import { parseLaunchChoice, serializeLaunchChoice } from './resolve-launch-choice';

const BASE = {
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  commitStyle: null,
  hint: null,
} as const;

describe('the stored launch choice mode', () => {
  it('keeps propose through a round trip', () => {
    const json = serializeLaunchChoice({ choice: { ...BASE, mode: 'propose' } });
    expect(parseLaunchChoice({ json })).toMatchObject({ mode: 'propose' });
  });

  it('reads a choice stored before the mode existed as one without a mode', () => {
    const json = JSON.stringify(BASE);
    expect(parseLaunchChoice({ json })?.mode).toBeUndefined();
  });

  it('drops a mode it does not know', () => {
    const json = JSON.stringify({ ...BASE, mode: 'rewrite' });
    expect(parseLaunchChoice({ json })?.mode).toBeUndefined();
  });
});
