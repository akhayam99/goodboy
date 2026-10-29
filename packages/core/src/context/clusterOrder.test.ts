import { describe, expect, it } from 'vitest';
import { readClusterChecks } from './clusterChecks';
import { extractClustersFromMarker } from './marker-parsing';

describe('cluster id and after', () => {
  it('keeps a part id and its after list from the clusters marker', () => {
    const text = `<<clusters>>${JSON.stringify([
      { title: 'shared', instructions: 'x', id: ' routes ', touches: ['src/routes.ts'] },
      { title: 'a', instructions: 'y', id: 'a', after: [' routes ', '', 4, 'routes'] },
      { title: 'b', instructions: 'z', id: 'has space', after: 'routes' },
    ])}<</clusters>>`;
    const clusters = extractClustersFromMarker({ assistantText: text, emittingProvider: null });
    expect(clusters?.[0]?.id).toBe('routes');
    expect(clusters?.[1]).toMatchObject({ id: 'a', after: ['routes'] });
    expect(clusters?.[2]).toEqual({ title: 'b', instructions: 'z' });
  });

  it('drops an id that is too long', () => {
    expect(readClusterChecks({ id: 'x'.repeat(41) })).toEqual({});
    expect(readClusterChecks({ id: 'x'.repeat(40) })).toEqual({ id: 'x'.repeat(40) });
  });

  it('caps the after list', () => {
    const after = Array.from({ length: 12 }, (_, index) => `p${index}`);
    expect(readClusterChecks({ after }).after).toHaveLength(8);
  });
});
