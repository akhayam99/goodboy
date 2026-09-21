import { describe, expect, it } from 'vitest';
import { resolveStagedFlow } from '.';

describe('resolveStagedFlow', () => {
  it('sends straight away and hides the stepper for a single question', () => {
    expect(resolveStagedFlow({ total: 1, index: 0 })).toEqual({
      index: 0,
      total: 1,
      showsStepper: false,
      canGoBack: false,
      action: 'send',
    });
  });

  it('continues on every question but the last', () => {
    expect(resolveStagedFlow({ total: 3, index: 0 }).action).toBe('continue');
    expect(resolveStagedFlow({ total: 3, index: 1 }).action).toBe('continue');
    expect(resolveStagedFlow({ total: 3, index: 2 }).action).toBe('send');
  });

  it('blocks Back on the first question only', () => {
    expect(resolveStagedFlow({ total: 3, index: 0 }).canGoBack).toBe(false);
    expect(resolveStagedFlow({ total: 3, index: 1 }).canGoBack).toBe(true);
  });

  it('clamps an index that outlived its questions', () => {
    expect(resolveStagedFlow({ total: 2, index: 9 }).index).toBe(1);
    expect(resolveStagedFlow({ total: 2, index: -4 }).index).toBe(0);
  });

  it('stays sane when every question is gone', () => {
    expect(resolveStagedFlow({ total: 0, index: 3 })).toEqual({
      index: 0,
      total: 0,
      showsStepper: false,
      canGoBack: false,
      action: 'send',
    });
  });
});
