import { describe, expect, it } from 'vitest';
import { MODEL_CATALOGS } from './catalogs';
import { getCheapModel, getMidModel } from './cli-defaults';
import { cliModelId } from './cliModelId';
import { CURSOR_AUTO_MODEL } from './cursor/models';
import { isSpawnableAsItself } from './spawnableAsItself';

const MAX_MODE_ONLY_CURSOR_KEYS = MODEL_CATALOGS.cursor
  .filter((model) => model.combos.every((combo) => combo.maxMode))
  .map((model) => model.key);

describe('isSpawnableAsItself', () => {
  it('finds the cursor models that only exist behind Max Mode', () => {
    expect(MAX_MODE_ONLY_CURSOR_KEYS.length).toBeGreaterThan(0);
    for (const key of MAX_MODE_ONLY_CURSOR_KEYS) {
      expect(isSpawnableAsItself({ providerId: 'cursor', modelId: key })).toBe(false);
      expect(cliModelId({ provider: 'cursor', model: key })).toBe(CURSOR_AUTO_MODEL);
    }
  });

  it('keeps every other cursor model spawnable as itself', () => {
    const spawnable = MODEL_CATALOGS.cursor.filter(
      (model) => !MAX_MODE_ONLY_CURSOR_KEYS.includes(model.key) && model.key !== CURSOR_AUTO_MODEL,
    );
    for (const model of spawnable) {
      expect(isSpawnableAsItself({ providerId: 'cursor', modelId: model.key })).toBe(true);
      expect(cliModelId({ provider: 'cursor', model: model.key })).not.toBe(CURSOR_AUTO_MODEL);
    }
  });
});

describe('cursor defaults that reach a cliModelId consumer', () => {
  it('never picks a mid model cliModelId would swap for Auto', () => {
    const mid = getMidModel('cursor');
    expect(MAX_MODE_ONLY_CURSOR_KEYS).not.toContain(mid);
    expect(cliModelId({ provider: 'cursor', model: mid })).not.toBe(CURSOR_AUTO_MODEL);
  });

  it('never picks a cheap model cliModelId would swap for something else', () => {
    const cheap = getCheapModel('cursor');
    expect(MAX_MODE_ONLY_CURSOR_KEYS).not.toContain(cheap);
    expect(cliModelId({ provider: 'cursor', model: cheap })).toBe(cheap);
  });
});
