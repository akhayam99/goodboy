import { describe, expect, it } from 'vitest';
import { modelCatalogKey } from './modelCatalogKey';

describe('modelCatalogKey', () => {
  it('reads an anthropic key and its cli id as the same catalog entry', () => {
    expect(modelCatalogKey({ provider: 'anthropic', modelId: 'sonnet-5' })).toBe('sonnet-5');
    expect(modelCatalogKey({ provider: 'anthropic', modelId: 'claude-sonnet-5' })).toBe('sonnet-5');
  });

  it('collapses two cursor combo slugs of the same model onto one key', () => {
    expect(modelCatalogKey({ provider: 'cursor', modelId: 'claude-sonnet-5-high' })).toBe(
      modelCatalogKey({ provider: 'cursor', modelId: 'claude-sonnet-5-xhigh' }),
    );
    expect(modelCatalogKey({ provider: 'cursor', modelId: 'claude-sonnet-5-xhigh' })).toBe(
      'sonnet-5',
    );
  });

  it('keeps two genuinely different models apart', () => {
    expect(modelCatalogKey({ provider: 'anthropic', modelId: 'claude-opus-4-6' })).not.toBe(
      modelCatalogKey({ provider: 'anthropic', modelId: 'claude-sonnet-5' }),
    );
    expect(modelCatalogKey({ provider: 'codex', modelId: 'gpt-6-astra' })).not.toBe(
      modelCatalogKey({ provider: 'codex', modelId: 'gpt-5.6-sol' }),
    );
  });

  it('refuses to name a key for an id no provider offers', () => {
    expect(modelCatalogKey({ provider: 'anthropic', modelId: 'not-a-model' })).toBeNull();
    expect(modelCatalogKey({ provider: 'cursor', modelId: 'not-a-model' })).toBeNull();
  });
});
