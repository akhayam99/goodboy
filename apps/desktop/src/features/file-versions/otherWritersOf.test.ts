import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import { changeTurnsOf } from './changeTurnsOf';
import { otherWritersOf } from './otherWritersOf';
import { testTurn } from './testing/testTurn';
import { turnWritersOf } from './turnWritersOf';

const NOTES = '/mock/Documents/acme-notes';

const turns = changeTurnsOf({
  turns: [
    testTurn({
      runId: 'run-1',
      finishedAtMs: 10,
      folderPath: NOTES,
      changes: [{ relativePath: 'pricing.md' }, { relativePath: 'faq.md' }],
    }),
    testTurn({
      runId: 'run-2',
      finishedAtMs: 20,
      folderPath: NOTES,
      changes: [{ relativePath: 'pricing.md' }],
    }),
    testTurn({
      runId: 'run-3',
      finishedAtMs: 30,
      folderPath: NOTES,
      changes: [{ relativePath: 'faq.md' }],
    }),
  ],
  restored: {},
  titles: {},
});

const writers = { 'run-1': 'Auto', 'run-2': 'Scout', 'run-3': 'Auto' };

describe('otherWritersOf', () => {
  it('names the other agent whose later turn wrote one of the changed files', () => {
    expect(
      otherWritersOf({ runId: 'run-1', changedSince: ['pricing.md'], turns, writers }),
    ).toEqual(['Scout']);
  });

  it('never names the agent that wrote the turn itself, nor a turn before it', () => {
    expect(otherWritersOf({ runId: 'run-1', changedSince: ['faq.md'], turns, writers })).toEqual(
      [],
    );
    expect(
      otherWritersOf({ runId: 'run-2', changedSince: ['pricing.md'], turns, writers }),
    ).toEqual([]);
  });

  it('names nobody when the file changed outside any turn, the writer is unknown or the run is', () => {
    expect(otherWritersOf({ runId: 'run-1', changedSince: ['draft.md'], turns, writers })).toEqual(
      [],
    );
    expect(
      otherWritersOf({ runId: 'run-1', changedSince: ['pricing.md'], turns, writers: {} }),
    ).toEqual([]);
    expect(otherWritersOf({ runId: 'gone', changedSince: ['pricing.md'], turns, writers })).toEqual(
      [],
    );
  });

  it('lists each agent once', () => {
    const several = { 'run-1': 'Auto', 'run-2': 'Scout', 'run-3': 'Scout' };

    expect(
      otherWritersOf({
        runId: 'run-1',
        changedSince: ['pricing.md', 'faq.md'],
        turns,
        writers: several,
      }),
    ).toEqual(['Scout']);
  });
});

describe('turnWritersOf', () => {
  it('reads the agent of each run from the user message that opened it', () => {
    const auto = brandId<AgentId>({ value: 'agent-auto' });
    const scout = brandId<AgentId>({ value: 'agent-scout' });
    const open = (runId: string): TurnEvent => ({
      kind: 'user_text',
      runId: brandId<ProviderRunId>({ value: runId }),
      text: 'go',
      at: brandId<IsoDateTime>({ value: '2026-10-01T10:00:00.000Z' }),
    });

    expect(
      turnWritersOf({
        agents: [
          { id: auto, name: 'Auto' },
          { id: scout, name: 'Scout' },
        ],
        transcripts: { [auto]: [open('run-1')], [scout]: [open('run-2'), open('run-1')] },
      }),
    ).toEqual({ 'run-1': 'Auto', 'run-2': 'Scout' });
  });
});
