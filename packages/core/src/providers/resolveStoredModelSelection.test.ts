import { describe, expect, it } from 'vitest';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';

describe('resolveStoredModelSelection', () => {
  it('drops an effort the stored model has no axis for', () => {
    expect(
      resolveStoredModelSelection({ provider: 'cursor', id: 'composer-2.5-fast', effort: 'high' })
        .selection,
    ).toEqual({ key: 'composer-2.5', toggles: { thinking: false, fast: true } });
    expect(
      resolveStoredModelSelection({ provider: 'cursor', id: 'auto', effort: 'high' }).selection,
    ).toEqual({ key: 'auto' });
    expect(
      resolveStoredModelSelection({ provider: 'anthropic', id: 'haiku-4.5', effort: 'high' })
        .selection,
    ).toEqual({ key: 'haiku-4.5' });
  });

  it('keeps the effort of a model that offers one', () => {
    expect(
      resolveStoredModelSelection({ provider: 'cursor', id: 'kimi-k3-low', effort: 'max' })
        .selection,
    ).toEqual({ key: 'kimi-k3', effort: 'max', toggles: { thinking: false, fast: false } });
    expect(
      resolveStoredModelSelection({ provider: 'anthropic', id: 'opus-5', effort: 'xhigh' })
        .selection,
    ).toEqual({ key: 'opus-5', effort: 'xhigh' });
  });
});
