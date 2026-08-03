import type { IsoDateTime, PlanWithCount } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import type { TranscriptItem } from '../../utils/transcript-items';
import { selectSpawnRecord } from './spawnRecord';

const AT = '2026-01-01T00:00:00.000Z' as IsoDateTime;

const kickoff: TranscriptItem = { kind: 'user_text', key: 'u0', text: 'go', at: AT };

const fanOutText = [
  'splitting the work',
  '<<fan-out>>',
  '[{"area":"auth","query":"map the login path"},{"area":"routing","query":"map the router"}]',
  '<</fan-out>>',
].join('\n');

const plan = (): PlanWithCount =>
  ({
    id: 'p1',
    clusters: [
      { title: 'c0', instructions: 'do 0' },
      { title: 'c1', instructions: 'do 1' },
    ],
  }) as unknown as PlanWithCount;

describe('selectSpawnRecord', () => {
  it('anchors on the assistant turn that emitted the fan-out and reads its areas', () => {
    const record = selectSpawnRecord({
      items: [kickoff, { kind: 'assistant_text', key: 'a1', text: fanOutText }],
      plan: null,
    });
    expect(record.anchorKey).toBe('a1');
    expect(record.assignments).toEqual([
      { name: 'auth', text: 'map the login path' },
      { name: 'routing', text: 'map the router' },
    ]);
  });

  it('falls back to the kickoff turn and the cluster plan when no marker was emitted', () => {
    const record = selectSpawnRecord({ items: [kickoff], plan: plan() });
    expect(record.anchorKey).toBe('u0');
    expect(record.assignments).toEqual([
      { name: 'c0', text: 'do 0' },
      { name: 'c1', text: 'do 1' },
    ]);
  });

  it('reports no anchor and no assignments for an empty transcript', () => {
    expect(selectSpawnRecord({ items: [], plan: null })).toEqual({
      anchorKey: null,
      assignments: [],
    });
  });
});
