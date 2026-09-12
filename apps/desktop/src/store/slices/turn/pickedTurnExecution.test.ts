import { describe, expect, it } from 'vitest';
import { pickedTurnExecution } from './pickedTurnExecution';

describe('pickedTurnExecution', () => {
  it('says nothing was picked when there is no override', () => {
    expect(pickedTurnExecution({ override: undefined })).toEqual({ kind: 'unspecified' });
  });

  it('says nothing was picked when the override names only a provider', () => {
    expect(pickedTurnExecution({ override: { providerId: 'cursor' } })).toEqual({
      kind: 'unspecified',
    });
  });

  it('resolves a key to the execution it names', () => {
    expect(
      pickedTurnExecution({ override: { providerId: 'cursor', model: 'composer-2.5' } }),
    ).toEqual({ kind: 'resolved', id: 'composer-2.5' });
  });

  it('keeps the combo the selection carries', () => {
    expect(
      pickedTurnExecution({
        override: {
          providerId: 'cursor',
          model: 'composer-2.5',
          selection: { key: 'composer-2.5', toggles: { thinking: false, fast: true } },
        },
      }),
    ).toEqual({ kind: 'resolved', id: 'composer-2.5-fast' });
  });

  it('reads a key and its cli id as the same execution', () => {
    expect(
      pickedTurnExecution({ override: { providerId: 'anthropic', model: 'claude-opus-5' } }),
    ).toEqual(pickedTurnExecution({ override: { providerId: 'anthropic', model: 'opus-5' } }));
  });

  it('refuses to resolve a model no provider offers', () => {
    expect(
      pickedTurnExecution({ override: { providerId: 'cursor', model: 'not-a-model' } }),
    ).toEqual({ kind: 'unresolved', id: 'not-a-model' });
  });

  it('refuses to resolve a selection whose key no provider offers', () => {
    expect(
      pickedTurnExecution({
        override: {
          providerId: 'cursor',
          model: 'not-a-model',
          selection: { key: 'not-a-model' },
        },
      }),
    ).toEqual({ kind: 'unresolved', id: 'not-a-model' });
  });
});
