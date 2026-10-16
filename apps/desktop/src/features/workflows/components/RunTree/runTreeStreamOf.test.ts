import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { baseAgents, child, run, streamOf } from './testing/runTreeFixtures';
import { runTreeStreamOf } from './runTreeStreamOf';

const ARCHIVED_AT: IsoDateTime = JSON.parse('"2026-08-18T10:00:00.000Z"');

type PhaseParams = {
  readonly stream: ReturnType<typeof streamOf>;
  readonly id: string;
};

const phaseOf = ({ stream, id }: PhaseParams) => {
  const item = stream.items.find((candidate) => candidate.id === `agent:${id}`);
  return item?.kind === 'row' ? item.rowState : null;
};

describe('runTreeStreamOf', () => {
  it('draws a running step of an archived run as stopped', () => {
    const running = child({ id: 'live', minute: 14, status: 'running' });
    const stream = runTreeStreamOf({
      stream: streamOf({ agents: [...baseAgents, running] }),
      run: { ...run, discardedAt: ARCHIVED_AT },
      rowHeight: null,
    });

    expect(phaseOf({ stream, id: 'live' })).toMatchObject({
      phase: 'closed',
      reason: { kind: 'stopped' },
    });
  });

  it('leaves a live run untouched', () => {
    const running = child({ id: 'live', minute: 14, status: 'running' });
    const source = streamOf({ agents: [...baseAgents, running] });
    const stream = runTreeStreamOf({ stream: source, run, rowHeight: null });

    expect(phaseOf({ stream, id: 'live' })?.phase).toBe('running');
  });

  it('gives every row one height in the rail', () => {
    const stream = runTreeStreamOf({
      stream: streamOf({ agents: baseAgents }),
      run,
      rowHeight: 28,
    });

    expect(new Set(stream.items.map((item) => item.height))).toEqual(new Set([28]));
    expect(stream.items.every((item) => item.markerY === 14)).toBe(true);
  });
});
