// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MergeTrain } from '../../../store/slices/pr-series/mergeTrain';
import { trainActionIdOf, stopTrainActionIdOf } from '../actions/phoneActionIds';
import { TRAIN_ORDER_LINE, trainOfferOf } from './trainOfferOf';
import type { ReadyLine, WorkspaceScope } from './workspaceScope';

const WORKSPACE = 'ws-harborline';

const LINES: ReadonlyArray<ReadyLine> = [
  {
    sessionId: 'ses-one',
    prNumber: 11,
    headSha: 'aaaa111122223333',
    title: 'Round the ledger',
    repo: 'ledger-core',
    reason: 'First: smallest',
  },
  {
    sessionId: 'ses-two',
    prNumber: 12,
    headSha: 'bbbb444455556666',
    title: 'Notify on retry',
    repo: 'notify-relay',
    reason: null,
  },
];

type ScopeParams = {
  readonly lines?: ReadonlyArray<ReadyLine>;
  readonly train?: MergeTrain | null;
};

const scopeOf = ({ lines = LINES, train = null }: ScopeParams = {}): WorkspaceScope =>
  ({
    workspace: { id: WORKSPACE, name: 'Harborline' },
    readyLines: lines,
    mergeTrain: train,
  }) as unknown as WorkspaceScope;

const trainOf = (over: Partial<MergeTrain> = {}): MergeTrain =>
  ({
    id: 'train-1',
    cars: [
      { sessionId: 'ses-one', mountId: 'm1', prNumber: 11, repo: 'ledger-core', base: 'main' },
      { sessionId: 'ses-two', mountId: 'm2', prNumber: 12, repo: 'notify-relay', base: 'main' },
    ],
    method: 'squash',
    index: 0,
    step: 'merging',
    hasUpdated: false,
    merged: 0,
    isStopRequested: false,
    outcome: null,
    ...over,
  }) as unknown as MergeTrain;

describe('the train offer', () => {
  it('is absent below two ready pull requests and no train', () => {
    expect(trainOfferOf({ scope: scopeOf({ lines: LINES.slice(0, 1) }) })).toBeNull();
  });

  it('lists the ready pull requests in order with the head the phone will send back', () => {
    const offer = trainOfferOf({ scope: scopeOf() });
    expect(offer?.entries.map((entry) => [entry.prNumber, entry.headSha])).toEqual([
      [11, 'aaaa111122223333'],
      [12, 'bbbb444455556666'],
    ]);
    expect(offer?.orderLine).toBe(TRAIN_ORDER_LINE);
    expect(offer?.method).toBe('squash');
    expect(offer?.isBusy).toBe(false);
    expect(offer?.status).toBeNull();
    expect(offer?.stopActionId).toBeNull();
    expect(offer?.actionId).toBe(
      trainActionIdOf({
        workspaceId: WORKSPACE,
        entries: LINES.map((line) => ({
          sessionId: line.sessionId,
          prNumber: line.prNumber,
          expectedHeadSha: line.headSha,
        })),
      }),
    );
  });

  it('reports the running train with a line per car and the stop action', () => {
    const offer = trainOfferOf({ scope: scopeOf({ train: trainOf({ index: 1, merged: 1 }) }) });
    expect(offer?.isBusy).toBe(true);
    expect(offer?.status).toMatchObject({
      phase: 'running',
      index: 1,
      merged: 1,
      total: 2,
      step: 'merging',
      isStopRequested: false,
      stopReason: null,
    });
    expect(offer?.status?.cars.map((car) => car.state)).toEqual(['merged', 'merging']);
    expect(offer?.status?.line).toBe('Merging 2 of 2 · #12 notify-relay');
    expect(offer?.stopActionId).toBe(stopTrainActionIdOf({ trainId: 'train-1' }));
  });

  it('keeps the stop action off once a stop was asked for', () => {
    const offer = trainOfferOf({ scope: scopeOf({ train: trainOf({ isStopRequested: true }) }) });
    expect(offer?.status?.isStopRequested).toBe(true);
    expect(offer?.stopActionId).toBeNull();
  });

  it('names the waiting and updating steps of the current car', () => {
    const waiting = trainOfferOf({ scope: scopeOf({ train: trainOf({ step: 'waiting' }) }) });
    expect(waiting?.status?.cars[0]?.line).toBe('#11 ledger-core · Checks running');
    const updating = trainOfferOf({ scope: scopeOf({ train: trainOf({ step: 'updating' }) }) });
    expect(updating?.status?.cars[0]?.line).toBe('#11 ledger-core · Updating on main');
  });

  it('gives the reason and the car it stopped at when the train stops', () => {
    const offer = trainOfferOf({
      scope: scopeOf({
        train: trainOf({
          merged: 1,
          index: 1,
          outcome: {
            kind: 'stopped',
            reason: '#12 has conflicts. The Lead has it',
            isWithLead: true,
          },
        }),
      }),
    });
    expect(offer?.isBusy).toBe(false);
    expect(offer?.status).toMatchObject({
      phase: 'stopped',
      stopReason: '#12 has conflicts. The Lead has it',
      isWithLead: true,
    });
    expect(offer?.status?.cars.map((car) => car.state)).toEqual(['merged', 'stopped']);
    expect(offer?.stopActionId).toBeNull();
  });

  it('says halted when the user stopped it after a pull request', () => {
    const offer = trainOfferOf({
      scope: scopeOf({ train: trainOf({ merged: 1, index: 1, outcome: { kind: 'halted' } }) }),
    });
    expect(offer?.status).toMatchObject({
      phase: 'halted',
      merged: 1,
      line: 'Stopped after 1 of 2',
    });
    expect(offer?.status?.cars.map((car) => car.state)).toEqual(['merged', 'queued']);
  });
});
